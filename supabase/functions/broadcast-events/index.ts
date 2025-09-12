import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DatabaseService } from '../_shared/database.ts'
import { 
  Logger, 
  createCorsHeaders, 
  createJsonResponse, 
  createErrorResponse,
  PerformanceMonitor
} from '../_shared/utils.ts'
import { BroadcastEvent, BroadcastChannel } from '../_shared/types.ts'

const logger = new Logger('BroadcastEvents')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createCorsHeaders() })
  }

  const monitor = new PerformanceMonitor(logger)
  
  try {
    const { 
      event_type, 
      event_data, 
      project_id, 
      user_id, 
      channel = 'project_updates',
      message,
      metadata 
    } = await req.json()
    
    logger.info('Broadcasting event', { 
      event_type, 
      project_id, 
      user_id, 
      channel,
      has_data: !!event_data
    })

    const db = DatabaseService.create()
    monitor.mark('db_initialized')

    // Validate required fields
    if (!event_type || !project_id) {
      return createErrorResponse(
        'Missing required fields: event_type and project_id',
        400,
        'MISSING_FIELDS'
      )
    }

    // Create broadcast event record
    const broadcastEvent: BroadcastEvent = {
      event_type,
      event_data: event_data || {},
      project_id,
      user_id,
      channel: channel as BroadcastChannel,
      message: message || generateEventMessage(event_type, event_data),
      timestamp: new Date().toISOString(),
      metadata: metadata || {}
    }

    monitor.mark('event_prepared')

    // Store the broadcast event for audit trail
    const { data: storedEvent, error: storeError } = await db.supabase
      .from('broadcast_events')
      .insert(broadcastEvent)
      .select()
      .single()

    if (storeError) {
      logger.warn('Failed to store broadcast event', storeError)
      // Continue with broadcast even if storage fails
    } else {
      monitor.mark('event_stored')
    }

    // Broadcast to real-time subscribers
    const broadcastResult = await broadcastToSubscribers(db, broadcastEvent)
    monitor.mark('event_broadcasted')

    // Send targeted notifications if specified
    if (user_id) {
      await sendUserNotification(db, user_id, broadcastEvent)
      monitor.mark('user_notified')
    }

    // Update project activity timestamp
    await updateProjectActivity(db, project_id)
    monitor.mark('project_updated')

    const totalTime = monitor.getTotalTime()
    logger.info('Event broadcasted successfully', {
      event_type,
      project_id,
      user_id,
      channel,
      broadcast_result,
      total_time_ms: totalTime.toFixed(2),
      metrics: monitor.getMetrics()
    })

    return createJsonResponse({
      event_id: storedEvent?.id,
      broadcasted: true,
      channel,
      timestamp: broadcastEvent.timestamp,
      subscribers_notified: broadcastResult.subscribers_count
    })

  } catch (error) {
    const totalTime = monitor.getTotalTime()
    logger.error('Event broadcasting failed', error, { 
      total_time_ms: totalTime.toFixed(2) 
    })
    return createErrorResponse(
      'Event broadcasting failed',
      500,
      'BROADCAST_ERROR'
    )
  }
})

// Broadcast event to real-time subscribers
async function broadcastToSubscribers(
  db: DatabaseService, 
  event: BroadcastEvent
): Promise<{ success: boolean; subscribers_count: number }> {
  try {
    // Use Supabase real-time to broadcast the event
    const channel = db.supabase.channel(`${event.channel}:${event.project_id}`)
    
    const broadcastPayload = {
      type: event.event_type,
      payload: {
        project_id: event.project_id,
        event_data: event.event_data,
        message: event.message,
        timestamp: event.timestamp,
        metadata: event.metadata
      }
    }

    // Send the broadcast
    const result = await channel.send({
      type: 'broadcast',
      event: event.event_type,
      payload: broadcastPayload
    })

    logger.debug('Real-time broadcast sent', {
      channel: event.channel,
      project_id: event.project_id,
      event_type: event.event_type,
      result
    })

    // Also insert into a real-time table that clients can subscribe to
    const { error: realtimeError } = await db.supabase
      .from('realtime_events')
      .insert({
        project_id: event.project_id,
        event_type: event.event_type,
        event_data: event.event_data,
        message: event.message,
        channel: event.channel,
        user_id: event.user_id,
        timestamp: event.timestamp
      })

    if (realtimeError) {
      logger.warn('Failed to insert realtime event', realtimeError)
    }

    return {
      success: true,
      subscribers_count: 1 // Supabase doesn't provide subscriber count
    }

  } catch (error) {
    logger.error('Failed to broadcast to subscribers', error)
    return {
      success: false,
      subscribers_count: 0
    }
  }
}

// Send targeted notification to specific user
async function sendUserNotification(
  db: DatabaseService, 
  userId: string, 
  event: BroadcastEvent
): Promise<void> {
  try {
    // Create user notification record
    const { error } = await db.supabase
      .from('user_notifications')
      .insert({
        user_id: userId,
        project_id: event.project_id,
        notification_type: event.event_type,
        title: generateNotificationTitle(event.event_type),
        message: event.message,
        data: event.event_data,
        read: false,
        created_at: new Date().toISOString()
      })

    if (error) {
      logger.warn('Failed to create user notification', error, { userId })
    } else {
      logger.debug('User notification created', { userId, event_type: event.event_type })
    }

    // Send real-time notification to user's personal channel
    const userChannel = db.supabase.channel(`user:${userId}`)
    await userChannel.send({
      type: 'broadcast',
      event: 'notification',
      payload: {
        type: event.event_type,
        project_id: event.project_id,
        message: event.message,
        timestamp: event.timestamp
      }
    })

  } catch (error) {
    logger.warn('Failed to send user notification', error, { userId })
  }
}

// Update project's last activity timestamp
async function updateProjectActivity(
  db: DatabaseService, 
  projectId: number
): Promise<void> {
  try {
    const { error } = await db.supabase
      .from('projects')
      .update({ 
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)

    if (error) {
      logger.warn('Failed to update project activity', error, { projectId })
    }
  } catch (error) {
    logger.warn('Failed to update project activity', error, { projectId })
  }
}

// Generate human-readable message for event
function generateEventMessage(eventType: string, eventData: any): string {
  switch (eventType) {
    case 'project_created':
      return 'New project created'
    case 'analysis_started':
      return 'Starting conversation analysis'
    case 'analysis_completed':
      return 'Conversation analysis completed'
    case 'plan_generation_started':
      return 'Generating project plan'
    case 'plan_generation_completed':
      return 'Project plan generated successfully'
    case 'build_triggered':
      return 'Build process initiated'
    case 'build_started':
      return 'Build process started'
    case 'build_progress':
      const progress = eventData?.progress || 0
      const step = eventData?.step || 'Processing'
      return `${step}: ${progress}% complete`
    case 'build_completed':
      return 'Build completed successfully'
    case 'build_failed':
      const error = eventData?.error || 'Unknown error'
      return `Build failed: ${error}`
    case 'file_generated':
      const fileName = eventData?.file_name || 'file'
      return `Generated ${fileName}`
    case 'status_changed':
      const newStatus = eventData?.status || 'unknown'
      return `Status changed to ${newStatus}`
    default:
      return `Event: ${eventType}`
  }
}

// Generate notification title for user notifications
function generateNotificationTitle(eventType: string): string {
  switch (eventType) {
    case 'project_created':
      return 'Project Created'
    case 'analysis_completed':
      return 'Analysis Complete'
    case 'plan_generation_completed':
      return 'Plan Ready'
    case 'build_completed':
      return 'Build Complete'
    case 'build_failed':
      return 'Build Failed'
    case 'build_progress':
      return 'Build Update'
    default:
      return 'Project Update'
  }
}