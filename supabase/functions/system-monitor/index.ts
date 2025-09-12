import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DatabaseService } from '../_shared/database.ts'
import { 
  Logger, 
  createCorsHeaders, 
  createJsonResponse, 
  createErrorResponse,
  PerformanceMonitor
} from '../_shared/utils.ts'

const logger = new Logger('SystemMonitor')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createCorsHeaders() })
  }

  const monitor = new PerformanceMonitor(logger)
  
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'health'
    const timeframe = url.searchParams.get('timeframe') || '24h'
    
    logger.info('System monitor request', { action, timeframe })

    const db = DatabaseService.create()
    monitor.mark('db_initialized')

    let result: any

    switch (action) {
      case 'health':
        result = await getSystemHealth(db)
        break
      case 'metrics':
        result = await getSystemMetrics(db, timeframe)
        break
      case 'performance':
        result = await getPerformanceMetrics(db, timeframe)
        break
      case 'errors':
        result = await getErrorAnalysis(db, timeframe)
        break
      case 'usage':
        result = await getUsageAnalytics(db, timeframe)
        break
      case 'alerts':
        result = await getActiveAlerts(db)
        break
      default:
        return createErrorResponse('Invalid action', 400, 'INVALID_ACTION')
    }

    monitor.mark('data_collected')

    const totalTime = monitor.getTotalTime()
    logger.info('System monitor completed', {
      action,
      timeframe,
      total_time_ms: totalTime.toFixed(2),
      data_points: Array.isArray(result) ? result.length : Object.keys(result).length
    })

    return createJsonResponse({
      action,
      timeframe,
      timestamp: new Date().toISOString(),
      data: result,
      collection_time_ms: totalTime
    })

  } catch (error) {
    const totalTime = monitor.getTotalTime()
    logger.error('System monitoring failed', error, { 
      total_time_ms: totalTime.toFixed(2) 
    })
    return createErrorResponse(
      'System monitoring failed',
      500,
      'MONITORING_ERROR'
    )
  }
})

// Get overall system health status
async function getSystemHealth(db: DatabaseService): Promise<any> {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {},
    database: {},
    queue: {},
    api: {}
  }

  try {
    // Check database connectivity
    const { data: dbTest, error: dbError } = await db.supabase
      .from('projects')
      .select('count')
      .limit(1)

    health.database = {
      status: dbError ? 'unhealthy' : 'healthy',
      error: dbError?.message,
      response_time_ms: 0 // Would measure actual response time
    }

    // Check queue status
    const { data: queueData, error: queueError } = await db.supabase
      .from('processing_queue')
      .select('status, count(*)')
      .in('status', ['pending', 'processing', 'failed'])

    const queueStats = queueData?.reduce((acc: any, row: any) => {
      acc[row.status] = row.count
      return acc
    }, {}) || {}

    health.queue = {
      status: queueError ? 'unhealthy' : 'healthy',
      pending_tasks: queueStats.pending || 0,
      processing_tasks: queueStats.processing || 0,
      failed_tasks: queueStats.failed || 0,
      error: queueError?.message
    }

    // Check API usage in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: apiData, error: apiError } = await db.supabase
      .from('api_usage')
      .select('api_name, request_count, avg(response_time_ms)')
      .gte('created_at', oneHourAgo)

    health.api = {
      status: apiError ? 'unhealthy' : 'healthy',
      recent_requests: apiData?.reduce((sum: number, row: any) => sum + row.request_count, 0) || 0,
      avg_response_time: apiData?.reduce((sum: number, row: any) => sum + row.avg, 0) / (apiData?.length || 1) || 0,
      error: apiError?.message
    }

    // Determine overall status
    const serviceStatuses = [
      health.database.status,
      health.queue.status,
      health.api.status
    ]

    if (serviceStatuses.includes('unhealthy')) {
      health.status = 'unhealthy'
    } else if (serviceStatuses.includes('degraded')) {
      health.status = 'degraded'
    }

  } catch (error) {
    logger.error('Health check failed', error)
    health.status = 'unhealthy'
    health.error = error.message
  }

  return health
}

// Get system metrics for specified timeframe
async function getSystemMetrics(db: DatabaseService, timeframe: string): Promise<any> {
  const timeframeDuration = parseTimeframe(timeframe)
  const startTime = new Date(Date.now() - timeframeDuration).toISOString()

  const metrics = {
    timeframe,
    start_time: startTime,
    end_time: new Date().toISOString(),
    projects: {},
    conversations: {},
    builds: {},
    queue: {}
  }

  try {
    // Project metrics
    const { data: projectData } = await db.supabase
      .from('projects')
      .select('status, created_at')
      .gte('created_at', startTime)

    metrics.projects = {
      total_created: projectData?.length || 0,
      by_status: projectData?.reduce((acc: any, p: any) => {
        acc[p.status] = (acc[p.status] || 0) + 1
        return acc
      }, {}) || {}
    }

    // Conversation metrics
    const { data: conversationData } = await db.supabase
      .from('conversations')
      .select('status, created_at, duration_seconds')
      .gte('created_at', startTime)

    metrics.conversations = {
      total_processed: conversationData?.length || 0,
      avg_duration: conversationData?.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) / (conversationData?.length || 1) || 0,
      by_status: conversationData?.reduce((acc: any, c: any) => {
        acc[c.status] = (acc[c.status] || 0) + 1
        return acc
      }, {}) || {}
    }

    // Build metrics
    const { data: buildData } = await db.supabase
      .from('build_events')
      .select('event_type, created_at, project_id')
      .gte('created_at', startTime)

    metrics.builds = {
      total_events: buildData?.length || 0,
      unique_projects: new Set(buildData?.map((b: any) => b.project_id)).size || 0,
      by_event_type: buildData?.reduce((acc: any, b: any) => {
        acc[b.event_type] = (acc[b.event_type] || 0) + 1
        return acc
      }, {}) || {}
    }

    // Queue metrics
    const { data: queueData } = await db.supabase
      .from('processing_queue')
      .select('task_type, status, created_at, completed_at')
      .gte('created_at', startTime)

    const completedTasks = queueData?.filter((t: any) => t.completed_at) || []
    const avgProcessingTime = completedTasks.length > 0 
      ? completedTasks.reduce((sum: number, t: any) => {
          const processingTime = new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()
          return sum + processingTime
        }, 0) / completedTasks.length
      : 0

    metrics.queue = {
      total_tasks: queueData?.length || 0,
      completed_tasks: completedTasks.length,
      avg_processing_time_ms: avgProcessingTime,
      by_task_type: queueData?.reduce((acc: any, t: any) => {
        acc[t.task_type] = (acc[t.task_type] || 0) + 1
        return acc
      }, {}) || {},
      by_status: queueData?.reduce((acc: any, t: any) => {
        acc[t.status] = (acc[t.status] || 0) + 1
        return acc
      }, {}) || {}
    }

  } catch (error) {
    logger.error('Failed to collect system metrics', error)
    metrics.error = error.message
  }

  return metrics
}

// Get performance metrics
async function getPerformanceMetrics(db: DatabaseService, timeframe: string): Promise<any> {
  const timeframeDuration = parseTimeframe(timeframe)
  const startTime = new Date(Date.now() - timeframeDuration).toISOString()

  const performance = {
    timeframe,
    api_performance: {},
    database_performance: {},
    queue_performance: {},
    resource_usage: {}
  }

  try {
    // API performance metrics
    const { data: apiUsage } = await db.supabase
      .from('api_usage')
      .select('api_name, endpoint, response_time_ms, status_code, created_at')
      .gte('created_at', startTime)

    if (apiUsage) {
      const apiStats = apiUsage.reduce((acc: any, usage: any) => {
        const key = `${usage.api_name}:${usage.endpoint}`
        if (!acc[key]) {
          acc[key] = {
            total_requests: 0,
            total_response_time: 0,
            success_count: 0,
            error_count: 0
          }
        }
        
        acc[key].total_requests++
        acc[key].total_response_time += usage.response_time_ms
        
        if (usage.status_code >= 200 && usage.status_code < 400) {
          acc[key].success_count++
        } else {
          acc[key].error_count++
        }
        
        return acc
      }, {})

      performance.api_performance = Object.entries(apiStats).reduce((acc: any, [key, stats]: [string, any]) => {
        acc[key] = {
          total_requests: stats.total_requests,
          avg_response_time_ms: stats.total_response_time / stats.total_requests,
          success_rate: stats.success_count / stats.total_requests,
          error_rate: stats.error_count / stats.total_requests
        }
        return acc
      }, {})
    }

    // Database performance (simplified)
    const { data: slowQueries } = await db.supabase
      .from('api_usage')
      .select('endpoint, response_time_ms')
      .gte('created_at', startTime)
      .gte('response_time_ms', 1000) // Queries taking more than 1 second
      .order('response_time_ms', { ascending: false })
      .limit(10)

    performance.database_performance = {
      slow_queries_count: slowQueries?.length || 0,
      slowest_queries: slowQueries || []
    }

    // Queue performance
    const { data: queuePerf } = await db.supabase
      .from('processing_queue')
      .select('task_type, created_at, started_at, completed_at')
      .gte('created_at', startTime)
      .not('completed_at', 'is', null)

    if (queuePerf) {
      const queueStats = queuePerf.reduce((acc: any, task: any) => {
        if (!acc[task.task_type]) {
          acc[task.task_type] = {
            total_tasks: 0,
            total_wait_time: 0,
            total_processing_time: 0
          }
        }
        
        acc[task.task_type].total_tasks++
        
        if (task.started_at) {
          const waitTime = new Date(task.started_at).getTime() - new Date(task.created_at).getTime()
          acc[task.task_type].total_wait_time += waitTime
        }
        
        if (task.completed_at && task.started_at) {
          const processingTime = new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()
          acc[task.task_type].total_processing_time += processingTime
        }
        
        return acc
      }, {})

      performance.queue_performance = Object.entries(queueStats).reduce((acc: any, [taskType, stats]: [string, any]) => {
        acc[taskType] = {
          total_tasks: stats.total_tasks,
          avg_wait_time_ms: stats.total_wait_time / stats.total_tasks,
          avg_processing_time_ms: stats.total_processing_time / stats.total_tasks
        }
        return acc
      }, {})
    }

  } catch (error) {
    logger.error('Failed to collect performance metrics', error)
    performance.error = error.message
  }

  return performance
}

// Get error analysis
async function getErrorAnalysis(db: DatabaseService, timeframe: string): Promise<any> {
  const timeframeDuration = parseTimeframe(timeframe)
  const startTime = new Date(Date.now() - timeframeDuration).toISOString()

  const errorAnalysis = {
    timeframe,
    total_errors: 0,
    error_rate: 0,
    by_source: {},
    by_type: {},
    recent_errors: []
  }

  try {
    // Get API errors
    const { data: apiErrors } = await db.supabase
      .from('api_usage')
      .select('api_name, endpoint, status_code, created_at')
      .gte('created_at', startTime)
      .gte('status_code', 400)

    // Get queue task failures
    const { data: queueErrors } = await db.supabase
      .from('processing_queue')
      .select('task_type, error_message, created_at')
      .eq('status', 'failed')
      .gte('created_at', startTime)

    // Get build failures
    const { data: buildErrors } = await db.supabase
      .from('build_events')
      .select('event_type, event_data, created_at')
      .eq('event_type', 'build_failed')
      .gte('created_at', startTime)

    const allErrors = [
      ...(apiErrors?.map((e: any) => ({ ...e, source: 'api' })) || []),
      ...(queueErrors?.map((e: any) => ({ ...e, source: 'queue' })) || []),
      ...(buildErrors?.map((e: any) => ({ ...e, source: 'build' })) || [])
    ]

    errorAnalysis.total_errors = allErrors.length

    // Calculate error rate (errors per hour)
    const hoursInTimeframe = timeframeDuration / (1000 * 60 * 60)
    errorAnalysis.error_rate = allErrors.length / hoursInTimeframe

    // Group by source
    errorAnalysis.by_source = allErrors.reduce((acc: any, error: any) => {
      acc[error.source] = (acc[error.source] || 0) + 1
      return acc
    }, {})

    // Group by type/status code
    errorAnalysis.by_type = allErrors.reduce((acc: any, error: any) => {
      const type = error.status_code || error.task_type || error.event_type || 'unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})

    // Recent errors (last 10)
    errorAnalysis.recent_errors = allErrors
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)

  } catch (error) {
    logger.error('Failed to analyze errors', error)
    errorAnalysis.error = error.message
  }

  return errorAnalysis
}

// Get usage analytics
async function getUsageAnalytics(db: DatabaseService, timeframe: string): Promise<any> {
  const timeframeDuration = parseTimeframe(timeframe)
  const startTime = new Date(Date.now() - timeframeDuration).toISOString()

  const usage = {
    timeframe,
    user_activity: {},
    feature_usage: {},
    resource_consumption: {},
    trends: {}
  }

  try {
    // User activity
    const { data: userActivity } = await db.supabase
      .from('projects')
      .select('user_id, created_at, status')
      .gte('created_at', startTime)

    usage.user_activity = {
      active_users: new Set(userActivity?.map((p: any) => p.user_id)).size || 0,
      total_projects: userActivity?.length || 0,
      avg_projects_per_user: userActivity ? userActivity.length / new Set(userActivity.map((p: any) => p.user_id)).size : 0
    }

    // Feature usage
    const { data: featureUsage } = await db.supabase
      .from('api_usage')
      .select('endpoint, request_count')
      .gte('created_at', startTime)

    usage.feature_usage = featureUsage?.reduce((acc: any, usage: any) => {
      acc[usage.endpoint] = (acc[usage.endpoint] || 0) + usage.request_count
      return acc
    }, {}) || {}

    // Resource consumption
    const { data: resourceData } = await db.supabase
      .from('api_usage')
      .select('api_name, request_count, response_time_ms')
      .gte('created_at', startTime)

    usage.resource_consumption = resourceData?.reduce((acc: any, usage: any) => {
      if (!acc[usage.api_name]) {
        acc[usage.api_name] = {
          total_requests: 0,
          total_response_time: 0
        }
      }
      acc[usage.api_name].total_requests += usage.request_count
      acc[usage.api_name].total_response_time += usage.response_time_ms * usage.request_count
      return acc
    }, {}) || {}

  } catch (error) {
    logger.error('Failed to collect usage analytics', error)
    usage.error = error.message
  }

  return usage
}

// Get active alerts
async function getActiveAlerts(db: DatabaseService): Promise<any> {
  const alerts = {
    active_alerts: [],
    alert_summary: {
      critical: 0,
      warning: 0,
      info: 0
    }
  }

  try {
    // Check for various alert conditions
    const currentAlerts = []

    // High error rate alert
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentErrors } = await db.supabase
      .from('api_usage')
      .select('count')
      .gte('status_code', 400)
      .gte('created_at', oneHourAgo)

    const errorCount = recentErrors?.length || 0
    if (errorCount > 50) { // More than 50 errors in the last hour
      currentAlerts.push({
        id: 'high_error_rate',
        severity: 'critical',
        title: 'High Error Rate Detected',
        message: `${errorCount} errors in the last hour`,
        timestamp: new Date().toISOString()
      })
    }

    // Queue backlog alert
    const { data: queueBacklog } = await db.supabase
      .from('processing_queue')
      .select('count')
      .eq('status', 'pending')

    const backlogCount = queueBacklog?.length || 0
    if (backlogCount > 100) { // More than 100 pending tasks
      currentAlerts.push({
        id: 'queue_backlog',
        severity: 'warning',
        title: 'Queue Backlog Alert',
        message: `${backlogCount} tasks pending in queue`,
        timestamp: new Date().toISOString()
      })
    }

    // Slow response time alert
    const { data: slowResponses } = await db.supabase
      .from('api_usage')
      .select('avg(response_time_ms)')
      .gte('created_at', oneHourAgo)

    const avgResponseTime = slowResponses?.[0]?.avg || 0
    if (avgResponseTime > 5000) { // Average response time > 5 seconds
      currentAlerts.push({
        id: 'slow_response',
        severity: 'warning',
        title: 'Slow Response Time',
        message: `Average response time: ${avgResponseTime.toFixed(0)}ms`,
        timestamp: new Date().toISOString()
      })
    }

    alerts.active_alerts = currentAlerts
    alerts.alert_summary = currentAlerts.reduce((acc: any, alert: any) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1
      return acc
    }, { critical: 0, warning: 0, info: 0 })

  } catch (error) {
    logger.error('Failed to check alerts', error)
    alerts.error = error.message
  }

  return alerts
}

// Parse timeframe string to milliseconds
function parseTimeframe(timeframe: string): number {
  const timeframeMap: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  }

  return timeframeMap[timeframe] || timeframeMap['24h']
}