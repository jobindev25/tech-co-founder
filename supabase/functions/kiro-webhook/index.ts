import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DatabaseService } from '../_shared/database.ts'
import { 
  Logger, 
  createCorsHeaders, 
  createJsonResponse, 
  createErrorResponse,
  verifyWebhookSignature,
  PerformanceMonitor,
  validateRequired,
  retryWithBackoff,
  rateLimiters
} from '../_shared/utils.ts'
import { 
  KiroWebhookPayload, 
  BuildEventType, 
  ProjectStatus, 
  PipelineError 
} from '../_shared/types.ts'

const logger = new Logger('KiroWebhook')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createCorsHeaders() })
  }

  // Only allow POST requests for webhook
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED')
  }

  const monitor = new PerformanceMonitor(logger)
  const requestId = `kiro_webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    // Rate limiting check
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown'
    if (!rateLimiters.kiro.isAllowed(clientIP)) {
      logger.warn('Rate limit exceeded for Kiro webhook', { client_ip: clientIP, request_id: requestId })
      return createErrorResponse('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // Enhanced webhook signature verification
    const body = await req.text()
    const signature = req.headers.get('x-kiro-signature') || ''
    const timestamp = req.headers.get('x-kiro-timestamp') || ''
    const webhookId = req.headers.get('x-kiro-webhook-id') || ''
    
    monitor.mark('request_parsed')

    // Validate timestamp to prevent replay attacks
    const timestampMs = parseInt(timestamp) * 1000
    const now = Date.now()
    const maxAge = 5 * 60 * 1000 // 5 minutes
    
    if (timestamp && (now - timestampMs > maxAge || timestampMs > now + 60000)) {
      logger.warn('Webhook timestamp outside acceptable range', { 
        timestamp, 
        age_ms: now - timestampMs,
        request_id: requestId 
      })
      return createErrorResponse('Invalid timestamp', 401, 'INVALID_TIMESTAMP')
    }

    // Verify webhook signature for security
    const webhookSecret = Deno.env.get('KIRO_WEBHOOK_SECRET')
    if (webhookSecret) {
      const isValidSignature = await verifyWebhookSignature(body, signature, webhookSecret, timestamp)
      if (!isValidSignature) {
        logger.warn('Invalid webhook signature', { 
          signature: signature.substring(0, 10) + '...', 
          timestamp, 
          webhook_id: webhookId,
          request_id: requestId 
        })
        return createErrorResponse('Invalid webhook signature', 401, 'INVALID_SIGNATURE')
      }
    } else {
      logger.warn('Webhook secret not configured - signature verification skipped', { request_id: requestId })
    }

    monitor.mark('signature_verified')

    // Parse and validate payload
    let payload: KiroWebhookPayload
    try {
      payload = JSON.parse(body)
    } catch (parseError) {
      logger.error('Failed to parse webhook payload', parseError, { request_id: requestId })
      return createErrorResponse('Invalid JSON payload', 400, 'INVALID_PAYLOAD')
    }

    // Validate required fields
    try {
      validateRequired<KiroWebhookPayload>(payload, ['build_id', 'event_type'])
    } catch (validationError) {
      logger.error('Webhook payload validation failed', validationError, { 
        payload: { ...payload, data: '[redacted]' },
        request_id: requestId 
      })
      return createErrorResponse(validationError.message, 400, 'VALIDATION_ERROR')
    }

    const { build_id, project_id: kiro_project_id, event_type, data, metadata } = payload
    
    logger.info('Kiro webhook received', {
      build_id,
      kiro_project_id,
      event_type,
      webhook_id: webhookId,
      request_id: requestId,
      timestamp: new Date().toISOString()
    })

    const db = DatabaseService.create()
    monitor.mark('db_initialized')

    // Find project by Kiro build ID with retry logic
    const project = await retryWithBackoff(
      () => findProjectByKiroBuildId(db, build_id),
      { maxRetries: 2, delays: [100, 500], backoffMultiplier: 2 }
    )
    
    if (!project) {
      logger.warn('Project not found for Kiro build', { 
        build_id, 
        kiro_project_id, 
        request_id: requestId 
      })
      return createErrorResponse('Project not found', 404, 'PROJECT_NOT_FOUND')
    }

    monitor.mark('project_found')

    // Store build event with enhanced error handling
    const buildEvent = await retryWithBackoff(
      () => db.buildEvents.createBuildEvent({
        project_id: project.id,
        kiro_build_id: build_id,
        event_type: mapKiroEventType(event_type),
        event_data: {
          ...data || {},
          webhook_id: webhookId,
          request_id: requestId,
          received_at: new Date().toISOString()
        },
        message: generateEventMessage(event_type, data),
        timestamp: new Date().toISOString(),
        sequence_number: data?.sequence_number
      }),
      { maxRetries: 3, delays: [100, 500, 1000], backoffMultiplier: 2 }
    )

    monitor.mark('build_event_stored')

    // Update project status based on event with transaction safety
    const statusUpdate = await retryWithBackoff(
      () => updateProjectFromKiroEvent(db, project, event_type, data, requestId),
      { maxRetries: 2, delays: [200, 1000], backoffMultiplier: 2 }
    )
    monitor.mark('project_status_updated')

    // Enhanced real-time broadcasting with multiple channels
    await Promise.allSettled([
      // Broadcast via Supabase real-time
      broadcastRealtimeUpdate(db, project.id, {
        event_type: mapKiroEventType(event_type),
        data: data || {},
        message: buildEvent.message,
        timestamp: buildEvent.timestamp,
        project_status: statusUpdate?.status || project.status,
        request_id: requestId
      }),
      
      // Broadcast via dedicated broadcast service
      broadcastViaWebSocketManager(project.id, {
        type: 'kiro_event',
        event_type: mapKiroEventType(event_type),
        project_id: project.id,
        data: data || {},
        message: buildEvent.message,
        timestamp: buildEvent.timestamp,
        project_status: statusUpdate?.status || project.status
      }),

      // Broadcast via broadcast events service
      broadcastViaBroadcastService(project.id, {
        event_type: `kiro_${mapKiroEventType(event_type)}`,
        event_data: {
          build_id,
          kiro_project_id,
          ...data || {}
        },
        project_id: project.id,
        message: buildEvent.message,
        metadata: {
          webhook_id: webhookId,
          request_id: requestId,
          source: 'kiro_webhook'
        }
      })
    ])

    monitor.mark('realtime_broadcast_sent')

    // Handle specific event types with enhanced processing
    await handleSpecificKiroEvent(db, project, event_type, data, requestId)
    monitor.mark('specific_event_handled')

    const totalTime = monitor.getTotalTime()
    logger.info('Kiro webhook processed successfully', {
      build_id,
      project_id: project.id,
      event_type,
      webhook_id: webhookId,
      request_id: requestId,
      total_time_ms: totalTime.toFixed(2),
      metrics: monitor.getMetrics()
    })

    // Track API usage for monitoring
    await db.apiUsage.trackAPIUsage({
      api_name: 'kiro',
      endpoint: 'webhook',
      request_count: 1,
      response_time_ms: Math.round(totalTime),
      status_code: 200,
      project_id: project.id
    })

    return createJsonResponse({ 
      received: true,
      project_id: project.id,
      event_processed: event_type,
      request_id: requestId,
      timestamp: new Date().toISOString(),
      processing_time_ms: Math.round(totalTime)
    })

  } catch (error) {
    const totalTime = monitor.getTotalTime()
    
    // Enhanced error logging with context
    logger.error('Kiro webhook processing failed', error, { 
      request_id: requestId,
      total_time_ms: totalTime.toFixed(2),
      error_type: error.constructor.name,
      retryable: error instanceof PipelineError ? error.retryable : false
    })

    // Track failed API usage
    try {
      const db = DatabaseService.create()
      await db.apiUsage.trackAPIUsage({
        api_name: 'kiro',
        endpoint: 'webhook',
        request_count: 1,
        response_time_ms: Math.round(totalTime),
        status_code: 500
      })
    } catch (trackingError) {
      logger.warn('Failed to track API usage for error', trackingError)
    }
    
    // Return appropriate error response based on error type
    if (error instanceof PipelineError) {
      return createErrorResponse(
        error.message,
        error.code === 'VALIDATION_ERROR' ? 400 : 500,
        error.code,
        { request_id: requestId, retryable: error.retryable }
      )
    }
    
    return createErrorResponse(
      'Webhook processing failed',
      500,
      'WEBHOOK_PROCESSING_ERROR',
      { request_id: requestId }
    )
  }
})

// Find project by Kiro build ID
async function findProjectByKiroBuildId(db: DatabaseService, buildId: string) {
  try {
    const { data: projects, error } = await db.supabase
      .from('projects')
      .select('*')
      .eq('kiro_build_id', buildId)
      .limit(1)

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return projects?.[0] || null
  } catch (error) {
    logger.error('Failed to find project by Kiro build ID', error, { build_id: buildId })
    return null
  }
}

// Map Kiro event types to our internal event types
function mapKiroEventType(kiroEventType: string): BuildEventType {
  const eventMap: Record<string, BuildEventType> = {
    'build.started': 'build_started',
    'build.progress': 'build_progress', 
    'build.completed': 'build_completed',
    'build.failed': 'build_failed',
    'build.cancelled': 'build_cancelled',
    'file.generated': 'file_generated',
    'log.entry': 'log_entry'
  }

  return eventMap[kiroEventType] || 'log_entry'
}

// Generate human-readable message for build events
function generateEventMessage(eventType: string, data: any): string {
  switch (eventType) {
    case 'build.started':
      return 'Build started successfully'
    case 'build.progress':
      const progress = data?.progress || 0
      const step = data?.current_step || 'Processing'
      return `Build progress: ${progress}% - ${step}`
    case 'build.completed':
      return 'Build completed successfully'
    case 'build.failed':
      return `Build failed: ${data?.error || 'Unknown error'}`
    case 'build.cancelled':
      return 'Build was cancelled'
    case 'file.generated':
      return `File generated: ${data?.file_path || 'Unknown file'}`
    case 'log.entry':
      return data?.message || 'Log entry'
    default:
      return `Kiro event: ${eventType}`
  }
}

// Update project status based on Kiro event with enhanced validation
async function updateProjectFromKiroEvent(
  db: DatabaseService, 
  project: any, 
  eventType: string, 
  data: any,
  requestId: string
) {
  let updates: any = {}
  const currentTimestamp = new Date().toISOString()

  // Validate that we're not processing events out of order
  const lastEvent = await db.buildEvents.getLatestBuildEvent(project.id)
  const eventSequence = data?.sequence_number
  
  if (lastEvent && eventSequence && lastEvent.sequence_number && eventSequence <= lastEvent.sequence_number) {
    logger.warn('Received out-of-order event, skipping status update', {
      project_id: project.id,
      event_type: eventType,
      current_sequence: eventSequence,
      last_sequence: lastEvent.sequence_number,
      request_id: requestId
    })
    return null
  }

  switch (eventType) {
    case 'build.started':
      // Only update to building if not already in a later state
      if (['analyzing', 'planning', 'ready_to_build'].includes(project.status)) {
        updates = { 
          status: 'building' as ProjectStatus,
          metadata: {
            ...project.metadata,
            build_started_at: currentTimestamp,
            kiro_build_started: true,
            last_webhook_event: eventType,
            last_webhook_timestamp: currentTimestamp
          }
        }
      }
      break

    case 'build.progress':
      // Always update progress metadata, but don't change status
      const progress = Math.max(0, Math.min(100, data?.progress || 0))
      updates = {
        metadata: {
          ...project.metadata,
          latest_progress: progress,
          current_step: data?.current_step || data?.step,
          last_progress_update: currentTimestamp,
          progress_details: data?.details,
          estimated_completion: data?.estimated_completion,
          last_webhook_event: eventType,
          last_webhook_timestamp: currentTimestamp
        }
      }
      break

    case 'build.completed':
      updates = { 
        status: 'completed' as ProjectStatus,
        completed_at: currentTimestamp,
        metadata: {
          ...project.metadata,
          build_completed_at: currentTimestamp,
          final_progress: 100,
          build_artifacts: data?.artifacts || {},
          deployment_url: data?.deployment_url,
          repository_url: data?.repository_url,
          build_duration_ms: data?.duration_ms,
          last_webhook_event: eventType,
          last_webhook_timestamp: currentTimestamp
        }
      }
      break

    case 'build.failed':
      const errorMessage = data?.error || data?.message || 'Build failed'
      updates = { 
        status: 'failed' as ProjectStatus,
        error_message: errorMessage,
        metadata: {
          ...project.metadata,
          build_failed_at: currentTimestamp,
          failure_reason: errorMessage,
          failure_step: data?.failed_step || data?.step,
          failure_code: data?.error_code,
          failure_details: data?.details,
          build_logs_url: data?.logs_url,
          last_webhook_event: eventType,
          last_webhook_timestamp: currentTimestamp
        }
      }
      break

    case 'build.cancelled':
      updates = { 
        status: 'cancelled' as ProjectStatus,
        metadata: {
          ...project.metadata,
          build_cancelled_at: currentTimestamp,
          cancellation_reason: data?.reason || 'Build cancelled',
          cancelled_by: data?.cancelled_by,
          last_webhook_event: eventType,
          last_webhook_timestamp: currentTimestamp
        }
      }
      break

    case 'file.generated':
      // Update metadata with file generation info but don't change status
      updates = {
        metadata: {
          ...project.metadata,
          generated_files: [
            ...(project.metadata?.generated_files || []),
            {
              file_path: data?.file_path,
              file_type: data?.file_type,
              generated_at: currentTimestamp,
              size_bytes: data?.size_bytes
            }
          ].slice(-50), // Keep only last 50 files
          last_file_generated: data?.file_path,
          last_webhook_event: eventType,
          last_webhook_timestamp: currentTimestamp
        }
      }
      break

    case 'log.entry':
      // Store important log entries in metadata
      if (data?.level === 'error' || data?.level === 'warn') {
        updates = {
          metadata: {
            ...project.metadata,
            recent_logs: [
              ...(project.metadata?.recent_logs || []),
              {
                level: data.level,
                message: data.message,
                timestamp: currentTimestamp,
                component: data.component
              }
            ].slice(-20), // Keep only last 20 log entries
            last_webhook_event: eventType,
            last_webhook_timestamp: currentTimestamp
          }
        }
      }
      break

    default:
      // For unknown events, just update the last webhook info
      updates = {
        metadata: {
          ...project.metadata,
          last_webhook_event: eventType,
          last_webhook_timestamp: currentTimestamp,
          unknown_event_data: data
        }
      }
  }

  if (Object.keys(updates).length > 0) {
    try {
      const updatedProject = await db.projects.updateProject(project.id, updates)
      logger.debug('Project status updated', {
        project_id: project.id,
        old_status: project.status,
        new_status: updatedProject.status,
        event_type: eventType,
        request_id: requestId
      })
      return updatedProject
    } catch (error) {
      logger.error('Failed to update project status', error, {
        project_id: project.id,
        event_type: eventType,
        updates,
        request_id: requestId
      })
      throw new PipelineError(
        `Failed to update project status: ${error.message}`,
        'PROJECT_UPDATE_ERROR',
        { project_id: project.id, event_type: eventType },
        true
      )
    }
  }

  return null
}

// Enhanced real-time broadcasting via Supabase real-time
async function broadcastRealtimeUpdate(
  db: DatabaseService, 
  projectId: number, 
  updateData: any
) {
  try {
    // Insert into realtime_events table for client subscriptions
    const { error: realtimeError } = await db.supabase
      .from('realtime_events')
      .insert([{
        project_id: projectId,
        event_type: updateData.event_type,
        event_data: updateData.data || {},
        message: updateData.message,
        channel: 'project_updates',
        timestamp: updateData.timestamp,
        metadata: {
          source: 'kiro_webhook',
          request_id: updateData.request_id
        }
      }])

    if (realtimeError) {
      logger.warn('Failed to insert realtime event', realtimeError, { project_id: projectId })
    }

    // Also broadcast via Supabase channel
    const channel = db.supabase.channel(`project:${projectId}`)
    await channel.send({
      type: 'broadcast',
      event: 'kiro_update',
      payload: {
        project_id: projectId,
        ...updateData
      }
    })

    logger.debug('Real-time update broadcasted via Supabase', { 
      project_id: projectId,
      event_type: updateData.event_type 
    })
  } catch (error) {
    logger.error('Supabase real-time broadcast error', error, { project_id: projectId })
  }
}

// Broadcast via WebSocket manager service
async function broadcastViaWebSocketManager(projectId: number, message: any) {
  try {
    const websocketManagerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/websocket-manager`
    const response = await fetch(websocketManagerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        type: 'kiro_update',
        project_id: projectId.toString(),
        message
      })
    })

    if (!response.ok) {
      throw new Error(`WebSocket manager responded with ${response.status}`)
    }

    const result = await response.json()
    logger.debug('Broadcasted via WebSocket manager', { 
      project_id: projectId,
      recipients: result.recipients 
    })
  } catch (error) {
    logger.warn('WebSocket manager broadcast failed', error, { project_id: projectId })
  }
}

// Broadcast via broadcast events service
async function broadcastViaBroadcastService(projectId: number, eventData: any) {
  try {
    const broadcastUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/broadcast-events`
    const response = await fetch(broadcastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        ...eventData,
        project_id: projectId
      })
    })

    if (!response.ok) {
      throw new Error(`Broadcast service responded with ${response.status}`)
    }

    const result = await response.json()
    logger.debug('Broadcasted via broadcast service', { 
      project_id: projectId,
      event_id: result.event_id 
    })
  } catch (error) {
    logger.warn('Broadcast service failed', error, { project_id: projectId })
  }
}

// Handle specific Kiro events that need additional processing
async function handleSpecificKiroEvent(
  db: DatabaseService,
  project: any,
  eventType: string,
  data: any,
  requestId: string
) {
  try {
    switch (eventType) {
      case 'build.started':
        // Queue notification for build start
        await db.queue.queueTask('send_notification', {
          project_id: project.id,
          notification_type: 'build_started',
          data: {
            project_name: project.project_name,
            build_id: data?.build_id || project.kiro_build_id,
            estimated_duration: data?.estimated_duration
          }
        }, 2)
        break

      case 'build.progress':
        // Only send progress notifications at certain milestones
        const progress = data?.progress || 0
        const milestones = [25, 50, 75, 90]
        const lastProgress = project.metadata?.latest_progress || 0
        
        const crossedMilestone = milestones.find(milestone => 
          lastProgress < milestone && progress >= milestone
        )
        
        if (crossedMilestone) {
          await db.queue.queueTask('send_notification', {
            project_id: project.id,
            notification_type: 'build_progress_milestone',
            data: {
              project_name: project.project_name,
              progress: crossedMilestone,
              current_step: data?.current_step || data?.step,
              estimated_completion: data?.estimated_completion
            }
          }, 1)
        }
        break

      case 'build.completed':
        // Send completion notification with enhanced data
        await db.queue.queueTask('send_notification', {
          project_id: project.id,
          notification_type: 'build_completed',
          data: {
            project_name: project.project_name,
            deployment_url: data?.deployment_url,
            repository_url: data?.repository_url,
            build_artifacts: data?.artifacts,
            build_duration: data?.duration_ms,
            final_size: data?.final_size_mb
          }
        }, 3)

        // Queue post-completion tasks
        await db.queue.queueTask('post_build_cleanup', {
          project_id: project.id,
          build_artifacts: data?.artifacts,
          deployment_url: data?.deployment_url
        }, 1)
        break

      case 'build.failed':
        // Enhanced failure handling
        const errorMessage = data?.error || data?.message || 'Build failed'
        const failureStep = data?.failed_step || data?.step
        
        // Send failure notification
        await db.queue.queueTask('send_notification', {
          project_id: project.id,
          notification_type: 'build_failed',
          data: {
            project_name: project.project_name,
            error_message: errorMessage,
            failure_step: failureStep,
            failure_code: data?.error_code,
            logs_url: data?.logs_url,
            support_ticket_url: data?.support_url
          }
        }, 4)

        // Enhanced retry logic
        const isRetryable = isRetryableFailure(errorMessage)
        const maxRetries = await db.config.getConfig('max_build_retries') || 2
        
        if (isRetryable && project.retry_count < maxRetries) {
          const retryDelay = Math.min(300000, 60000 * Math.pow(2, project.retry_count)) // Max 5 minutes
          
          logger.info('Queueing build retry', { 
            project_id: project.id, 
            retry_count: project.retry_count,
            retry_delay_ms: retryDelay,
            failure_reason: errorMessage,
            request_id: requestId
          })
          
          // Increment retry count first
          await db.projects.updateProject(project.id, {
            retry_count: project.retry_count + 1
          })
          
          // Queue retry with delay
          setTimeout(async () => {
            try {
              await db.queue.queueTask('trigger_build', {
                project_id: project.id,
                project_plan: project.project_plan,
                is_retry: true,
                retry_count: project.retry_count + 1,
                retry_reason: errorMessage,
                original_failure_step: failureStep
              }, 4)
            } catch (retryError) {
              logger.error('Failed to queue retry task', retryError, { 
                project_id: project.id,
                request_id: requestId 
              })
            }
          }, retryDelay)
        } else {
          // Mark as permanently failed if max retries exceeded
          if (project.retry_count >= maxRetries) {
            await db.projects.updateProject(project.id, {
              metadata: {
                ...project.metadata,
                permanently_failed: true,
                max_retries_exceeded: true,
                final_failure_reason: errorMessage
              }
            })
          }
        }
        break

      case 'build.cancelled':
        // Send cancellation notification
        await db.queue.queueTask('send_notification', {
          project_id: project.id,
          notification_type: 'build_cancelled',
          data: {
            project_name: project.project_name,
            cancellation_reason: data?.reason || 'Build cancelled',
            cancelled_by: data?.cancelled_by
          }
        }, 2)
        break

      case 'file.generated':
        // Enhanced file generation tracking
        const filePath = data?.file_path
        const fileType = data?.file_type
        
        logger.debug('File generated', {
          project_id: project.id,
          file_path: filePath,
          file_type: fileType,
          size_bytes: data?.size_bytes,
          request_id: requestId
        })

        // Track important file types
        const importantFiles = ['package.json', 'README.md', 'index.html', 'main.js', 'app.py']
        if (filePath && importantFiles.some(important => filePath.includes(important))) {
          await db.queue.queueTask('send_notification', {
            project_id: project.id,
            notification_type: 'important_file_generated',
            data: {
              project_name: project.project_name,
              file_path: filePath,
              file_type: fileType
            }
          }, 1)
        }
        break

      case 'log.entry':
        // Handle important log entries
        if (data?.level === 'error') {
          logger.warn('Build error logged', {
            project_id: project.id,
            error_message: data?.message,
            component: data?.component,
            request_id: requestId
          })
        }
        break

      default:
        logger.debug('Unhandled Kiro event type', {
          project_id: project.id,
          event_type: eventType,
          request_id: requestId
        })
    }
  } catch (error) {
    logger.error('Failed to handle specific Kiro event', error, {
      project_id: project.id,
      event_type: eventType,
      request_id: requestId
    })
    // Don't throw - this is additional processing that shouldn't fail the webhook
  }
}

// Enhanced determination of retryable build failures
function isRetryableFailure(errorMessage: string): boolean {
  if (!errorMessage) return false
  
  const message = errorMessage.toLowerCase()
  
  // Definitely retryable errors
  const retryableErrors = [
    'timeout',
    'network error',
    'temporary failure',
    'rate limit',
    'service unavailable',
    'connection reset',
    'connection refused',
    'dns resolution failed',
    'temporary server error',
    'internal server error',
    'gateway timeout',
    'service temporarily unavailable',
    'resource temporarily unavailable',
    'too many requests',
    'quota exceeded',
    'throttled'
  ]
  
  // Definitely non-retryable errors
  const nonRetryableErrors = [
    'syntax error',
    'compilation error',
    'invalid configuration',
    'authentication failed',
    'permission denied',
    'file not found',
    'invalid project structure',
    'unsupported language',
    'malformed request',
    'invalid api key',
    'account suspended',
    'plan limit exceeded'
  ]
  
  // Check for non-retryable errors first
  if (nonRetryableErrors.some(error => message.includes(error))) {
    return false
  }
  
  // Check for retryable errors
  if (retryableErrors.some(error => message.includes(error))) {
    return true
  }
  
  // Check for HTTP status codes in error message
  const httpErrorMatch = message.match(/\b(5\d{2})\b/) // 5xx errors are retryable
  if (httpErrorMatch) {
    return true
  }
  
  const clientErrorMatch = message.match(/\b(4\d{2})\b/) // 4xx errors are usually not retryable
  if (clientErrorMatch) {
    const statusCode = parseInt(clientErrorMatch[1])
    // Some 4xx errors are retryable
    return [408, 429, 499].includes(statusCode)
  }
  
  // Default to not retryable for unknown errors
  return false
}