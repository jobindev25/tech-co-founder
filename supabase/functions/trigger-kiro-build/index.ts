import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DatabaseService } from '../_shared/database.ts'
import { 
  Logger, 
  createCorsHeaders, 
  createJsonResponse, 
  createErrorResponse,
  retryWithBackoff,
  PerformanceMonitor,
  timeout,
  rateLimiters
} from '../_shared/utils.ts'
import { ProjectPlan, KiroAPIRequest, KiroAPIResponse, KiroAPIError } from '../_shared/types.ts'

const logger = new Logger('TriggerKiroBuild')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createCorsHeaders() })
  }

  const monitor = new PerformanceMonitor(logger)
  
  try {
    const { project_id, project_plan, kiro_config } = await req.json()
    
    logger.info('Starting Kiro build trigger', { 
      project_id,
      project_name: project_plan?.name || 'Unknown'
    })

    const db = DatabaseService.create()
    monitor.mark('db_initialized')

    // Get project details
    const project = await db.projects.getProject(project_id)
    if (!project) {
      return createErrorResponse('Project not found', 404, 'PROJECT_NOT_FOUND')
    }

    if (project.status !== 'ready_to_build') {
      logger.warn('Project not ready to build', { 
        project_id, 
        current_status: project.status 
      })
    }

    monitor.mark('project_retrieved')

    // Check if build already triggered
    if (project.kiro_build_id) {
      logger.info('Build already triggered for project', { 
        project_id, 
        kiro_build_id: project.kiro_build_id 
      })
      return createJsonResponse({
        project_id,
        kiro_build_id: project.kiro_build_id,
        status: 'already_triggered'
      })
    }

    // Update project status to building
    await db.projects.updateProjectStatus(project_id, 'building')

    // Format project plan for Kiro API
    const kiroPayload = formatForKiroAPI(project_plan, project)
    monitor.mark('payload_formatted')

    logger.info('Calling Kiro API', {
      project_id,
      project_name: kiroPayload.name,
      tech_stack: kiroPayload.techStack
    })

    // Call Kiro API with retry logic
    const kiroResponse = await timeout(
      retryWithBackoff(async () => {
        return await callKiroAPI(kiroPayload, project_id)
      }, {
        maxRetries: 3,
        delays: [2000, 5000, 10000],
        backoffMultiplier: 2
      }),
      120000 // 2 minute timeout
    )

    monitor.mark('kiro_api_called')

    // Update project with Kiro IDs
    const updatedProject = await db.projects.updateProject(project_id, {
      kiro_build_id: kiroResponse.build_id,
      kiro_project_id: kiroResponse.project_id,
      status: 'building',
      metadata: {
        ...project.metadata,
        kiro_build_triggered_at: new Date().toISOString(),
        kiro_estimated_completion: kiroResponse.estimated_completion,
        kiro_webhook_configured: kiroResponse.webhook_configured
      }
    })

    monitor.mark('project_updated')

    // Create initial build event
    await db.buildEvents.createBuildEvent({
      project_id,
      kiro_build_id: kiroResponse.build_id,
      event_type: 'build_started',
      event_data: {
        kiro_project_id: kiroResponse.project_id,
        estimated_completion: kiroResponse.estimated_completion,
        webhook_configured: kiroResponse.webhook_configured
      },
      message: 'Kiro build initiated successfully',
      timestamp: new Date().toISOString()
    })

    monitor.mark('build_event_created')

    // Track API usage
    await db.apiUsage.trackAPIUsage({
      api_name: 'kiro',
      endpoint: '/v1/projects',
      request_count: 1,
      response_time_ms: monitor.measure('kiro_api_time', 'payload_formatted', 'kiro_api_called'),
      status_code: 200,
      project_id: project_id
    })

    const totalTime = monitor.getTotalTime()
    logger.info('Kiro build triggered successfully', {
      project_id,
      kiro_build_id: kiroResponse.build_id,
      kiro_project_id: kiroResponse.project_id,
      total_time_ms: totalTime.toFixed(2),
      metrics: monitor.getMetrics()
    })

    return createJsonResponse({
      project_id,
      kiro_build_id: kiroResponse.build_id,
      kiro_project_id: kiroResponse.project_id,
      status: 'build_triggered',
      estimated_completion: kiroResponse.estimated_completion,
      webhook_configured: kiroResponse.webhook_configured,
      build_url: `https://app.kiro.dev/builds/${kiroResponse.build_id}`
    })

  } catch (error) {
    const totalTime = monitor.getTotalTime()
    
    if (error instanceof KiroAPIError) {
      logger.error('Kiro API error', error, { 
        total_time_ms: totalTime.toFixed(2) 
      })
      
      // Update project status to failed
      try {
        const { project_id } = await req.json()
        await DatabaseService.create().projects.updateProjectStatus(
          project_id, 
          'failed', 
          `Kiro API error: ${error.message}`
        )
      } catch (updateError) {
        logger.error('Failed to update project status after Kiro error', updateError)
      }
      
      return createErrorResponse(
        `Kiro build failed: ${error.message}`,
        error.context?.statusCode || 500,
        'KIRO_API_ERROR'
      )
    }

    logger.error('Kiro build trigger failed', error, { 
      total_time_ms: totalTime.toFixed(2) 
    })
    
    return createErrorResponse(
      'Kiro build trigger failed',
      500,
      'BUILD_TRIGGER_ERROR'
    )
  }
})

// Format project plan for Kiro API consumption
function formatForKiroAPI(plan: ProjectPlan, project: any): KiroAPIRequest {
  return {
    name: plan.name,
    description: plan.description,
    techStack: {
      frontend: Array.isArray(plan.techStack.frontend) 
        ? plan.techStack.frontend[0] 
        : plan.techStack.frontend,
      backend: Array.isArray(plan.techStack.backend) 
        ? plan.techStack.backend[0] 
        : plan.techStack.backend,
      database: plan.techStack.database
    },
    features: plan.features.map((feature, index) => ({
      name: feature.name,
      description: feature.description,
      priority: getPriorityScore(feature.priority)
    })),
    architecture: plan.architecture.type,
    timeline: plan.timeline.estimated_hours,
    webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/kiro-webhook`,
    real_time_updates: true,
    metadata: {
      conversation_id: project.conversation_id,
      project_id: project.id,
      created_at: project.created_at,
      priority: project.priority,
      file_structure: plan.fileStructure,
      dependencies: plan.dependencies,
      kiro_config: plan.kiroConfig
    }
  }
}

// Convert priority string to numeric score
function getPriorityScore(priority: string): number {
  const scores = { high: 3, medium: 2, low: 1 }
  return scores[priority as keyof typeof scores] || 2
}

// Call Kiro API with proper error handling
async function callKiroAPI(payload: KiroAPIRequest, projectId: number): Promise<KiroAPIResponse> {
  const kiroApiKey = Deno.env.get('KIRO_API_KEY')
  if (!kiroApiKey) {
    throw new KiroAPIError('KIRO_API_KEY environment variable not configured', 500)
  }

  // Check rate limit
  if (!rateLimiters.kiro.isAllowed('default')) {
    throw new KiroAPIError('Kiro API rate limit exceeded', 429)
  }

  const startTime = performance.now()
  
  try {
    logger.debug('Making Kiro API request', { 
      project_name: payload.name,
      tech_stack: payload.techStack 
    })

    const response = await fetch('https://api.kiro.dev/v1/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kiroApiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'TechCoFounder/1.0'
      },
      body: JSON.stringify(payload)
    })

    const responseTime = performance.now() - startTime
    logger.debug('Kiro API response received', { 
      status: response.status, 
      response_time_ms: responseTime.toFixed(2) 
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Kiro API error: ${response.statusText}`
      
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch (parseError) {
        errorMessage = errorText || errorMessage
      }
      
      throw new KiroAPIError(errorMessage, response.status, {
        response_body: errorText,
        project_id: projectId
      })
    }

    const responseData = await response.json()
    
    // Validate response structure
    if (!responseData.build_id || !responseData.project_id) {
      throw new KiroAPIError('Invalid response from Kiro API: missing build_id or project_id', 502, {
        response_data: responseData
      })
    }

    return {
      build_id: responseData.build_id,
      project_id: responseData.project_id,
      status: responseData.status || 'initiated',
      estimated_completion: responseData.estimated_completion || calculateEstimatedCompletion(payload.timeline),
      webhook_configured: responseData.webhook_configured || true
    }

  } catch (error) {
    if (error instanceof KiroAPIError) {
      throw error
    }
    
    // Handle network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new KiroAPIError('Failed to connect to Kiro API', 503, { 
        original_error: error.message,
        project_id: projectId
      })
    }
    
    throw new KiroAPIError(`Kiro API request failed: ${error.message}`, 500, {
      original_error: error.message,
      project_id: projectId
    })
  }
}

// Calculate estimated completion time based on project timeline
function calculateEstimatedCompletion(estimatedHours: number): string {
  // Assume 8 hours per day, 5 days per week
  const workingHoursPerDay = 8
  const workingDaysPerWeek = 5
  
  const totalDays = Math.ceil(estimatedHours / workingHoursPerDay)
  const totalWeeks = Math.ceil(totalDays / workingDaysPerWeek)
  
  const completionDate = new Date()
  completionDate.setDate(completionDate.getDate() + (totalWeeks * 7))
  
  return completionDate.toISOString()
}