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
  retryWithBackoff
} from '../_shared/utils.ts'

const logger = new Logger('TavusWebhook')

serve(async (req) => {
  logger.info('Tavus webhook handler invoked', { method: req.method, url: req.url })
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createCorsHeaders() })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED')
  }

  const monitor = new PerformanceMonitor(logger)
  const requestId = `tavus_webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    // Enhanced webhook signature verification
    const body = await req.text()
    const signature = req.headers.get('x-tavus-signature') || ''
    const timestamp = req.headers.get('x-tavus-timestamp') || ''
    
    monitor.mark('request_parsed')

    // Verify webhook signature if secret is configured
    const webhookSecret = Deno.env.get('TAVUS_WEBHOOK_SECRET')
    if (webhookSecret) {
      const isValidSignature = await verifyWebhookSignature(body, signature, webhookSecret, timestamp)
      if (!isValidSignature) {
        logger.warn('Invalid Tavus webhook signature', { 
          signature: signature.substring(0, 10) + '...', 
          timestamp,
          request_id: requestId 
        })
        return createErrorResponse('Invalid webhook signature', 401, 'INVALID_SIGNATURE')
      }
    } else {
      logger.warn('Tavus webhook secret not configured - signature verification skipped', { request_id: requestId })
    }

    monitor.mark('signature_verified')

    // Parse and validate payload
    let payload: any
    try {
      payload = JSON.parse(body)
    } catch (parseError) {
      logger.error('Failed to parse Tavus webhook payload', parseError, { request_id: requestId })
      return createErrorResponse('Invalid JSON payload', 400, 'INVALID_PAYLOAD')
    }

    // Validate required fields
    try {
      validateRequired(payload, ['event_type', 'conversation_id'])
    } catch (validationError) {
      logger.error('Tavus webhook payload validation failed', validationError, { 
        payload: { ...payload, data: '[redacted]' },
        request_id: requestId 
      })
      return createErrorResponse(validationError.message, 400, 'VALIDATION_ERROR')
    }

    const { event_type, conversation_id, data } = payload
    const db = DatabaseService.create()
    monitor.mark('db_initialized')
    
    logger.info('Tavus webhook received', {
      event_type,
      conversation_id,
      request_id: requestId,
      timestamp: new Date().toISOString(),
    })

    // Store webhook event in conversation_events table with retry logic
    await retryWithBackoff(async () => {
      const { error: dbError } = await db.supabase
        .from('conversation_events')
        .insert([
          {
            conversation_id,
            event_type,
            event_data: {
              ...data || {},
              request_id: requestId,
              received_at: new Date().toISOString()
            },
            received_at: new Date().toISOString()
          }
        ])

      if (dbError) {
        throw new Error(`Database error storing webhook event: ${dbError.message}`)
      }
    }, { maxRetries: 2, delays: [100, 500], backoffMultiplier: 2 })

    monitor.mark('event_stored')

    // Update conversation status based on event with enhanced error handling
    let updateData: any = {}
    
    switch (event_type) {
      case 'conversation_started':
        logger.info('Conversation started', { conversation_id, request_id: requestId })
        updateData = { 
          status: 'active',
          started_at: new Date().toISOString(),
          metadata: {
            last_webhook_event: event_type,
            last_webhook_timestamp: new Date().toISOString(),
            request_id: requestId
          }
        }
        break
        
      case 'conversation_ended':
        logger.info('Conversation ended - triggering pipeline', { conversation_id, request_id: requestId })
        updateData = { 
          status: 'completed',
          ended_at: new Date().toISOString(),
          metadata: {
            last_webhook_event: event_type,
            last_webhook_timestamp: new Date().toISOString(),
            request_id: requestId,
            duration_seconds: data?.duration_seconds,
            participant_count: data?.participant_count
          }
        }
        
        // Broadcast conversation completion to frontend
        await broadcastConversationCompleted(conversation_id, requestId)
        
        // Trigger automated development pipeline
        await triggerPipeline(db, conversation_id, data, requestId)
        break
        
      case 'participant_joined':
        logger.info('Participant joined', { conversation_id, request_id: requestId })
        updateData = { 
          participant_joined_at: new Date().toISOString(),
          metadata: {
            last_webhook_event: event_type,
            last_webhook_timestamp: new Date().toISOString(),
            request_id: requestId,
            participant_info: data?.participant
          }
        }
        break
        
      case 'participant_left':
        logger.info('Participant left', { conversation_id, request_id: requestId })
        updateData = { 
          participant_left_at: new Date().toISOString(),
          metadata: {
            last_webhook_event: event_type,
            last_webhook_timestamp: new Date().toISOString(),
            request_id: requestId,
            participant_info: data?.participant
          }
        }
        break
        
      case 'recording_ready':
        logger.info('Recording ready', { conversation_id, request_id: requestId })
        updateData = {
          metadata: {
            last_webhook_event: event_type,
            last_webhook_timestamp: new Date().toISOString(),
            request_id: requestId,
            recording_url: data?.recording_url,
            transcript_url: data?.transcript_url
          }
        }
        break
        
      default:
        logger.info('Unknown Tavus event type', { event_type, conversation_id, request_id: requestId })
        updateData = {
          metadata: {
            last_webhook_event: event_type,
            last_webhook_timestamp: new Date().toISOString(),
            request_id: requestId,
            unknown_event_data: data
          }
        }
    }

    if (Object.keys(updateData).length > 0) {
      await retryWithBackoff(async () => {
        const { error: updateError } = await db.supabase
          .from('conversations')
          .update(updateData)
          .eq('conversation_id', conversation_id)

        if (updateError) {
          throw new Error(`Failed to update conversation: ${updateError.message}`)
        }
      }, { maxRetries: 2, delays: [100, 500], backoffMultiplier: 2 })
    }

    monitor.mark('conversation_updated')

    const totalTime = monitor.getTotalTime()
    logger.info('Tavus webhook processed successfully', {
      conversation_id,
      event_type,
      request_id: requestId,
      total_time_ms: totalTime.toFixed(2),
      metrics: monitor.getMetrics()
    })

    // Track API usage for monitoring
    await db.apiUsage.trackAPIUsage({
      api_name: 'tavus',
      endpoint: 'webhook',
      request_count: 1,
      response_time_ms: Math.round(totalTime),
      status_code: 200
    })

    return createJsonResponse({ 
      received: true,
      conversation_id,
      event_processed: event_type,
      request_id: requestId,
      timestamp: new Date().toISOString(),
      processing_time_ms: Math.round(totalTime)
    })

  } catch (error) {
    const totalTime = monitor.getTotalTime()
    
    logger.error('Tavus webhook processing failed', error, { 
      request_id: requestId,
      total_time_ms: totalTime.toFixed(2),
      error_type: error.constructor.name
    })

    // Track failed API usage
    try {
      const db = DatabaseService.create()
      await db.apiUsage.trackAPIUsage({
        api_name: 'tavus',
        endpoint: 'webhook',
        request_count: 1,
        response_time_ms: Math.round(totalTime),
        status_code: 500
      })
    } catch (trackingError) {
      logger.warn('Failed to track API usage for error', trackingError)
    }
    
    return createErrorResponse(
      'Webhook processing failed',
      500,
      'WEBHOOK_PROCESSING_ERROR',
      { request_id: requestId }
    )
  }
})

// Enhanced pipeline trigger function with better error handling
async function triggerPipeline(db: DatabaseService, conversationId: string, data: any, requestId: string) {
  try {
    logger.info('Triggering automated development pipeline', { 
      conversationId, 
      request_id: requestId 
    })
    
    // Check if pipeline is enabled
    const pipelineEnabled = await db.config.getConfig('pipeline_enabled')
    if (pipelineEnabled !== 'true' && pipelineEnabled !== true) {
      logger.info('Pipeline disabled, skipping', { 
        conversationId, 
        pipeline_enabled: pipelineEnabled,
        request_id: requestId 
      })
      return
    }

    // Check if project already exists for this conversation
    const existingProject = await db.projects.getProjectByConversationId(conversationId)
    if (existingProject) {
      logger.info('Project already exists for conversation', { 
        conversationId, 
        projectId: existingProject.id,
        project_status: existingProject.status,
        request_id: requestId 
      })
      
      // If project failed, we can retry the pipeline
      if (existingProject.status === 'failed' && existingProject.retry_count < 2) {
        logger.info('Retrying failed project pipeline', {
          conversationId,
          projectId: existingProject.id,
          retry_count: existingProject.retry_count,
          request_id: requestId
        })
        
        // Reset project status and increment retry count
        await db.projects.updateProject(existingProject.id, {
          status: 'analyzing',
          retry_count: existingProject.retry_count + 1,
          error_message: null
        })
      } else {
        return
      }
    }

    // Validate that we have necessary data for analysis
    if (!data?.transcript_url && !data?.recording_url) {
      logger.warn('No transcript or recording URL available for analysis', {
        conversationId,
        available_data: Object.keys(data || {}),
        request_id: requestId
      })
      
      // Queue a delayed task to check for transcript later
      await db.queue.queueTask('check_transcript_availability', {
        conversation_id: conversationId,
        retry_count: 0,
        max_retries: 5,
        metadata: {
          triggered_at: new Date().toISOString(),
          request_id: requestId
        }
      }, 3)
      
      return
    }

    // Queue conversation analysis task with enhanced metadata
    const analysisTask = await db.queue.queueTask('analyze_conversation', {
      conversation_id: conversationId,
      transcript_url: data?.transcript_url,
      recording_url: data?.recording_url,
      summary: data?.summary,
      metadata: {
        ended_at: new Date().toISOString(),
        participant_count: data?.participant_count || 1,
        duration_seconds: data?.duration_seconds,
        language: data?.language || 'en',
        quality_score: data?.quality_score,
        triggered_by: 'tavus_webhook',
        request_id: requestId
      }
    }, 5) // High priority

    logger.info('Pipeline triggered successfully', { 
      conversationId,
      taskType: 'analyze_conversation',
      taskId: analysisTask.id,
      request_id: requestId
    })

  } catch (error) {
    logger.error('Failed to trigger pipeline', error, { 
      conversationId,
      request_id: requestId,
      error_type: error.constructor.name
    })
    
    // Create a fallback task to retry pipeline trigger later
    try {
      await db.queue.queueTask('retry_pipeline_trigger', {
        conversation_id: conversationId,
        original_data: data,
        error_message: error.message,
        retry_count: 0,
        metadata: {
          failed_at: new Date().toISOString(),
          request_id: requestId
        }
      }, 2) // Medium priority
      
      logger.info('Fallback pipeline retry task queued', { 
        conversationId,
        request_id: requestId 
      })
    } catch (fallbackError) {
      logger.error('Failed to queue fallback pipeline task', fallbackError, {
        conversationId,
        request_id: requestId
      })
    }
    
    // Don't fail the webhook - just log the error
    // The pipeline can be triggered manually later if needed
  }
}

// Broadcast conversation completion to frontend via WebSocket
async function broadcastConversationCompleted(conversationId: string, requestId: string) {
  try {
    logger.info('Broadcasting conversation completion', { 
      conversationId, 
      request_id: requestId 
    })

    // Call the broadcast-events function
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/broadcast-events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'conversation_completed',
        conversation_id: conversationId,
        data: {
          timestamp: new Date().toISOString(),
          request_id: requestId,
          redirect_url: `/project/${conversationId}`
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Broadcast failed: ${response.status} ${errorText}`)
    }

    logger.info('Conversation completion broadcast successful', { 
      conversationId, 
      request_id: requestId 
    })

  } catch (error) {
    logger.error('Failed to broadcast conversation completion', error, { 
      conversationId,
      request_id: requestId 
    })
    
    // Don't fail the webhook - broadcasting is not critical
    // The user can still manually navigate to the dashboard
  }
}
