import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DatabaseService } from '../_shared/database.ts'
import { 
  Logger, 
  createCorsHeaders, 
  createJsonResponse, 
  createErrorResponse,
  PerformanceMonitor
} from '../_shared/utils.ts'

const logger = new Logger('GetProjectData')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createCorsHeaders() })
  }

  const monitor = new PerformanceMonitor(logger)
  
  try {
    const url = new URL(req.url)
    const conversationId = url.searchParams.get('conversation_id')
    
    if (!conversationId) {
      return createErrorResponse('conversation_id parameter is required', 400, 'MISSING_CONVERSATION_ID')
    }

    logger.info('Fetching project data', { conversation_id: conversationId })

    const db = DatabaseService.create()
    monitor.mark('db_initialized')

    // Get conversation data
    const { data: conversation, error: conversationError } = await db.supabase
      .from('conversations')
      .select('*')
      .eq('conversation_id', conversationId)
      .single()

    if (conversationError) {
      logger.error('Error fetching conversation', conversationError, { conversation_id: conversationId })
      return createErrorResponse('Conversation not found', 404, 'CONVERSATION_NOT_FOUND')
    }

    monitor.mark('conversation_fetched')

    // Get project data if it exists
    const { data: project, error: projectError } = await db.supabase
      .from('projects')
      .select('*')
      .eq('conversation_id', conversationId)
      .single()

    // Project might not exist yet, that's okay
    if (projectError && projectError.code !== 'PGRST116') {
      logger.warn('Error fetching project', projectError, { conversation_id: conversationId })
    }

    monitor.mark('project_fetched')

    // Get recent build events
    const { data: buildEvents, error: eventsError } = await db.supabase
      .from('build_events')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: false })
      .limit(20)

    if (eventsError) {
      logger.warn('Error fetching build events', eventsError, { conversation_id: conversationId })
    }

    monitor.mark('events_fetched')

    // Prepare response data
    const responseData = {
      conversation_id: conversationId,
      project_name: project?.project_name || conversation?.conversation_name || `Project ${conversationId}`,
      project_description: project?.project_description || conversation?.conversation_summary || 'Your AI-generated application is being built...',
      status: project?.status || conversation?.status || 'analyzing',
      created_at: conversation?.created_at,
      started_at: conversation?.started_at,
      ended_at: conversation?.ended_at,
      project_plan: project?.project_plan,
      kiro_build_id: project?.kiro_build_id,
      kiro_project_id: project?.kiro_project_id,
      build_events: buildEvents || [],
      metadata: {
        conversation_metadata: conversation?.metadata,
        project_metadata: project?.metadata,
        last_updated: new Date().toISOString()
      }
    }

    const totalTime = monitor.getTotalTime()
    logger.info('Project data fetched successfully', {
      conversation_id: conversationId,
      has_project: !!project,
      build_events_count: buildEvents?.length || 0,
      total_time_ms: totalTime.toFixed(2)
    })

    return createJsonResponse(responseData)

  } catch (error) {
    const totalTime = monitor.getTotalTime()
    
    logger.error('Failed to fetch project data', error, { 
      total_time_ms: totalTime.toFixed(2) 
    })
    
    return createErrorResponse(
      'Failed to fetch project data',
      500,
      'FETCH_ERROR'
    )
  }
})