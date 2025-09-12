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
  timeout,
  validateProjectPlan
} from '../_shared/utils.ts'
import { ConversationAnalysis, ProjectPlan, AIAnalysisError } from '../_shared/types.ts'

const logger = new Logger('GenerateProjectPlan')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createCorsHeaders() })
  }

  const monitor = new PerformanceMonitor(logger)
  
  try {
    const { project_id, analysis, preferences } = await req.json()
    
    logger.info('Starting project plan generation', { 
      project_id,
      requirements_count: analysis?.requirements?.length || 0,
      features_count: analysis?.features?.length || 0
    })

    const db = DatabaseService.create()
    monitor.mark('db_initialized')

    // Get project details
    const project = await db.projects.getProject(project_id)
    if (!project) {
      return createErrorResponse('Project not found', 404, 'PROJECT_NOT_FOUND')
    }

    if (project.status !== 'planning') {
      logger.warn('Project not in planning status', { 
        project_id, 
        current_status: project.status 
      })
    }

    monitor.mark('project_retrieved')

    // Update project status to indicate plan generation in progress
    await db.projects.updateProjectStatus(project_id, 'planning')

    // Generate project plan with AI
    logger.info('Generating project plan with AI', { 
      project_id,
      project_name: project.project_name
    })

    const projectPlan = await timeout(
      retryWithBackoff(async () => {
        return await aiService.generateProjectPlan(analysis)
      }),
      600000 // 10 minute timeout for plan generation
    )

    monitor.mark('ai_plan_generated')

    // Validate the generated plan
    validateProjectPlan(projectPlan)
    monitor.mark('plan_validated')

    // Enhance plan with additional metadata
    const enhancedPlan = enhanceProjectPlan(projectPlan, project, analysis)
    monitor.mark('plan_enhanced')

    // Update project with the generated plan
    const updatedProject = await db.projects.updateProject(project_id, {
      project_plan: enhancedPlan,
      status: 'ready_to_build',
      metadata: {
        ...project.metadata,
        plan_generated_at: new Date().toISOString(),
        plan_generation_time_ms: monitor.measure('plan_generation_time', 'project_retrieved'),
        estimated_hours: enhancedPlan.timeline.estimated_hours,
        complexity_score: calculateComplexityScore(enhancedPlan)
      }
    })

    monitor.mark('project_updated')

    logger.info('Project plan generated successfully', {
      project_id,
      project_name: updatedProject.project_name,
      features_count: enhancedPlan.features.length,
      estimated_hours: enhancedPlan.timeline.estimated_hours,
      tech_stack: enhancedPlan.techStack
    })

    // Queue Kiro build trigger
    await db.queue.queueTask('trigger_build', {
      project_id,
      project_plan: enhancedPlan,
      kiro_config: enhancedPlan.kiroConfig
    }, 3) // Medium-high priority

    monitor.mark('build_task_queued')

    // Track API usage
    await db.apiUsage.trackAPIUsage({
      api_name: 'openai',
      endpoint: '/chat/completions',
      request_count: 1,
      response_time_ms: monitor.measure('ai_plan_time', 'project_retrieved', 'ai_plan_generated'),
      status_code: 200,
      project_id: project_id
    })

    const totalTime = monitor.getTotalTime()
    logger.info('Project plan generation completed', {
      project_id,
      total_time_ms: totalTime.toFixed(2),
      metrics: monitor.getMetrics()
    })

    return createJsonResponse({
      project_id,
      project_name: updatedProject.project_name,
      status: 'plan_generated',
      plan_summary: {
        features_count: enhancedPlan.features.length,
        estimated_hours: enhancedPlan.timeline.estimated_hours,
        phases_count: enhancedPlan.timeline.phases.length,
        tech_stack: enhancedPlan.techStack,
        complexity_score: calculateComplexityScore(enhancedPlan)
      },
      next_step: 'kiro_build_queued'
    })

  } catch (error) {
    const totalTime = monitor.getTotalTime()
    
    if (error instanceof AIAnalysisError) {
      logger.error('AI plan generation failed', error, { 
        total_time_ms: totalTime.toFixed(2) 
      })
      return createErrorResponse(
        `Plan generation failed: ${error.message}`,
        422,
        'AI_PLAN_ERROR'
      )
    }

    logger.error('Project plan generation failed', error, { 
      total_time_ms: totalTime.toFixed(2) 
    })
    return createErrorResponse(
      'Project plan generation failed',
      500,
      'PLAN_GENERATION_ERROR'
    )
  }
})

// Enhance the AI-generated plan with additional metadata and configuration
function enhanceProjectPlan(
  plan: ProjectPlan, 
  project: any, 
  analysis: ConversationAnalysis
): ProjectPlan {
  const enhanced = { ...plan }

  // Add webhook configuration for Kiro
  enhanced.kiroConfig = {
    ...enhanced.kiroConfig,
    webhookSettings: {
      url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/kiro-webhook`,
      events: ['build_started', 'build_progress', 'build_completed', 'build_failed', 'file_generated']
    },
    projectMetadata: {
      conversation_id: project.conversation_id,
      project_id: project.id,
      created_at: project.created_at,
      priority: project.priority
    }
  }

  // Enhance features with more detailed acceptance criteria
  enhanced.features = enhanced.features.map(feature => ({
    ...feature,
    acceptanceCriteria: feature.acceptanceCriteria || generateAcceptanceCriteria(feature),
    estimatedHours: estimateFeatureHours(feature),
    testingRequirements: generateTestingRequirements(feature)
  }))

  // Add deployment configuration based on tech stack
  enhanced.deployment = generateDeploymentConfig(enhanced.techStack)

  // Add monitoring and analytics configuration
  enhanced.monitoring = {
    errorTracking: true,
    performanceMonitoring: true,
    userAnalytics: true,
    logLevel: 'info'
  }

  // Add security considerations
  enhanced.security = generateSecurityConfig(enhanced.techStack, enhanced.features)

  return enhanced
}

// Generate acceptance criteria for a feature
function generateAcceptanceCriteria(feature: any): string[] {
  const criteria = [
    `GIVEN a user wants to use ${feature.name}`,
    `WHEN they ${feature.description.toLowerCase()}`,
    `THEN the system should respond appropriately`,
    `AND the feature should be accessible and user-friendly`
  ]

  // Add specific criteria based on feature type
  if (feature.name.toLowerCase().includes('auth')) {
    criteria.push('AND user credentials should be securely handled')
    criteria.push('AND session management should be implemented')
  }

  if (feature.name.toLowerCase().includes('payment')) {
    criteria.push('AND payment processing should be secure and PCI compliant')
    criteria.push('AND transaction records should be maintained')
  }

  if (feature.name.toLowerCase().includes('search')) {
    criteria.push('AND search results should be relevant and fast')
    criteria.push('AND search should handle edge cases gracefully')
  }

  return criteria
}

// Estimate hours for a feature based on complexity
function estimateFeatureHours(feature: any): number {
  let baseHours = 8 // Base implementation time

  // Adjust based on complexity
  if (feature.complexity) {
    baseHours *= feature.complexity
  }

  // Adjust based on priority (high priority features might need more polish)
  if (feature.priority === 'high') {
    baseHours *= 1.5
  } else if (feature.priority === 'low') {
    baseHours *= 0.8
  }

  // Add testing time (30% of implementation time)
  const testingHours = baseHours * 0.3

  return Math.ceil(baseHours + testingHours)
}

// Generate testing requirements for a feature
function generateTestingRequirements(feature: any): string[] {
  return [
    'Unit tests for core functionality',
    'Integration tests for API endpoints',
    'End-to-end tests for user workflows',
    'Error handling and edge case tests',
    'Performance tests for critical paths'
  ]
}

// Generate deployment configuration
function generateDeploymentConfig(techStack: any): any {
  const config: any = {
    environments: ['development', 'staging', 'production'],
    cicd: true,
    monitoring: true
  }

  // Frontend deployment
  if (techStack.frontend.includes('React') || techStack.frontend.includes('Next.js')) {
    config.frontend = {
      platform: 'vercel',
      buildCommand: 'npm run build',
      outputDirectory: 'dist',
      environmentVariables: ['REACT_APP_API_URL', 'REACT_APP_ENV']
    }
  }

  // Backend deployment
  if (techStack.backend.includes('Node.js')) {
    config.backend = {
      platform: 'railway',
      startCommand: 'npm start',
      healthCheck: '/health',
      environmentVariables: ['DATABASE_URL', 'JWT_SECRET', 'NODE_ENV']
    }
  }

  // Database deployment
  if (techStack.database === 'PostgreSQL') {
    config.database = {
      provider: 'supabase',
      backupSchedule: 'daily',
      connectionPooling: true
    }
  }

  return config
}

// Generate security configuration
function generateSecurityConfig(techStack: any, features: any[]): any {
  const config = {
    authentication: false,
    authorization: false,
    dataEncryption: true,
    inputValidation: true,
    rateLimiting: true,
    cors: true
  }

  // Check if authentication is needed
  const needsAuth = features.some(f => 
    f.name.toLowerCase().includes('auth') || 
    f.name.toLowerCase().includes('user') ||
    f.name.toLowerCase().includes('login')
  )

  if (needsAuth) {
    config.authentication = true
    config.authorization = true
  }

  // Add specific security measures based on features
  const needsPayment = features.some(f => 
    f.name.toLowerCase().includes('payment') ||
    f.name.toLowerCase().includes('billing')
  )

  if (needsPayment) {
    config.pciCompliance = true
    config.tokenization = true
  }

  return config
}

// Calculate complexity score for the project
function calculateComplexityScore(plan: ProjectPlan): number {
  let score = 0

  // Base score from number of features
  score += plan.features.length * 2

  // Add score based on feature complexity
  score += plan.features.reduce((sum, feature) => sum + (feature.complexity || 1), 0)

  // Add score based on tech stack complexity
  const techComplexity = {
    'React': 2, 'Next.js': 3, 'Vue': 2, 'Angular': 4,
    'Node.js': 2, 'Express': 1, 'FastAPI': 2, 'Django': 3,
    'PostgreSQL': 2, 'MongoDB': 2, 'Redis': 1
  }

  Object.values(plan.techStack).flat().forEach(tech => {
    score += techComplexity[tech as keyof typeof techComplexity] || 1
  })

  // Add score based on estimated hours
  score += Math.floor(plan.timeline.estimated_hours / 10)

  return Math.min(score, 100) // Cap at 100
}