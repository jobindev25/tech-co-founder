import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DatabaseService } from '../_shared/database.ts'
import { aiService } from '../_shared/ai-service.ts'
import { 
  Logger, 
  createCorsHeaders, 
  createJsonResponse, 
  createErrorResponse,
  retryWithBackoff,
  PerformanceMonitor,
  timeout
} from '../_shared/utils.ts'
import { ConversationAnalysis, AIAnalysisError } from '../_shared/types.ts'

const logger = new Logger('AnalyzeConversation')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createCorsHeaders() })
  }

  const monitor = new PerformanceMonitor(logger)
  
  try {
    const { conversation_id, transcript_url, summary, metadata } = await req.json()
    
    logger.info('Starting conversation analysis', { 
      conversation_id, 
      has_transcript_url: !!transcript_url,
      has_summary: !!summary
    })

    const db = DatabaseService.create()
    monitor.mark('db_initialized')

    // Check if project already exists
    const existingProject = await db.projects.getProjectByConversationId(conversation_id)
    if (existingProject) {
      logger.info('Project already exists', { 
        conversation_id, 
        project_id: existingProject.id 
      })
      return createJsonResponse({ 
        project_id: existingProject.id,
        status: 'already_exists' 
      })
    }

    monitor.mark('project_check_complete')

    // Retrieve conversation transcript
    let transcript = ''
    if (transcript_url) {
      transcript = await retrieveTranscript(transcript_url)
      monitor.mark('transcript_retrieved')
    } else if (summary) {
      // Use summary as fallback if no transcript URL
      transcript = `Conversation Summary: ${summary}`
      logger.warn('No transcript URL provided, using summary', { conversation_id })
    } else {
      throw new AIAnalysisError('No transcript URL or summary provided')
    }

    // Analyze conversation with AI
    logger.info('Analyzing conversation with AI', { 
      conversation_id,
      transcript_length: transcript.length 
    })

    const analysis = await timeout(
      retryWithBackoff(async () => {
        return await aiService.analyzeConversation(transcript, summary)
      }),
      300000 // 5 minute timeout
    )

    monitor.mark('ai_analysis_complete')

    // Create project record
    const project = await db.projects.createProject({
      conversation_id,
      project_name: analysis.projectName,
      project_description: analysis.description,
      conversation_summary: analysis.summary,
      status: 'planning',
      priority: determinePriority(analysis),
      metadata: {
        analysis,
        conversation_metadata: metadata,
        analysis_timestamp: new Date().toISOString(),
        transcript_length: transcript.length
      }
    })

    monitor.mark('project_created')

    logger.info('Project created successfully', { 
      conversation_id,
      project_id: project.id,
      project_name: project.project_name
    })

    // Queue project plan generation
    await db.queue.queueTask('generate_plan', {
      project_id: project.id,
      analysis,
      preferences: analysis.preferences
    }, 4) // High priority

    monitor.mark('plan_task_queued')

    // Track API usage
    await db.apiUsage.trackAPIUsage({
      api_name: 'openai',
      endpoint: '/chat/completions',
      request_count: 1,
      response_time_ms: monitor.measure('ai_analysis_time', 'transcript_retrieved'),
      status_code: 200,
      project_id: project.id
    })

    const totalTime = monitor.getTotalTime()
    logger.info('Conversation analysis completed', {
      conversation_id,
      project_id: project.id,
      total_time_ms: totalTime.toFixed(2),
      metrics: monitor.getMetrics()
    })

    return createJsonResponse({
      project_id: project.id,
      project_name: project.project_name,
      status: 'analysis_complete',
      analysis_summary: {
        requirements_count: analysis.requirements.length,
        features_count: analysis.features.length,
        complexity: analysis.preferences.complexity,
        timeline: analysis.preferences.timeline
      }
    })

  } catch (error) {
    const totalTime = monitor.getTotalTime()
    
    if (error instanceof AIAnalysisError) {
      logger.error('AI analysis failed', error, { 
        total_time_ms: totalTime.toFixed(2) 
      })
      return createErrorResponse(
        `AI analysis failed: ${error.message}`,
        422,
        'AI_ANALYSIS_ERROR'
      )
    }

    logger.error('Conversation analysis failed', error, { 
      total_time_ms: totalTime.toFixed(2) 
    })
    return createErrorResponse(
      'Conversation analysis failed',
      500,
      'ANALYSIS_ERROR'
    )
  }
})

// Retrieve transcript from Tavus API
async function retrieveTranscript(transcriptUrl: string): Promise<string> {
  try {
    logger.info('Retrieving transcript', { transcript_url: transcriptUrl })
    
    const response = await timeout(
      fetch(transcriptUrl, {
        headers: {
          'Authorization': `Bearer ${Deno.env.get('TAVUS_API_KEY')}`,
          'Accept': 'application/json'
        }
      }),
      30000 // 30 second timeout
    )

    if (!response.ok) {
      throw new Error(`Failed to retrieve transcript: ${response.statusText}`)
    }

    const data = await response.json()
    
    // Handle different transcript formats
    if (typeof data === 'string') {
      return data
    } else if (data.transcript) {
      return data.transcript
    } else if (data.text) {
      return data.text
    } else if (Array.isArray(data)) {
      // Handle transcript as array of segments
      return data.map(segment => segment.text || segment.content || '').join(' ')
    } else {
      throw new Error('Invalid transcript format received')
    }

  } catch (error) {
    logger.error('Failed to retrieve transcript', error, { transcript_url: transcriptUrl })
    throw new AIAnalysisError(`Failed to retrieve transcript: ${error.message}`)
  }
}

// Determine project priority based on analysis
function determinePriority(analysis: ConversationAnalysis): number {
  let priority = 1 // Default priority

  // Increase priority based on complexity
  if (analysis.preferences.complexity === 'simple') {
    priority += 1
  } else if (analysis.preferences.complexity === 'complex') {
    priority += 3
  } else {
    priority += 2 // medium complexity
  }

  // Increase priority for urgent timelines
  const timeline = analysis.preferences.timeline?.toLowerCase() || ''
  if (timeline.includes('urgent') || timeline.includes('asap') || timeline.includes('immediately')) {
    priority += 2
  } else if (timeline.includes('week') || timeline.includes('fast')) {
    priority += 1
  }

  // Increase priority for high-value features
  const highValueKeywords = ['payment', 'commerce', 'revenue', 'business', 'enterprise']
  const hasHighValueFeatures = analysis.features.some(feature =>
    highValueKeywords.some(keyword => 
      feature.toLowerCase().includes(keyword)
    )
  )
  
  if (hasHighValueFeatures) {
    priority += 1
  }

  // Cap priority at 5
  return Math.min(priority, 5)
}