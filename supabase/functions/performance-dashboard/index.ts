import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DatabaseService } from '../_shared/database.ts'
import { 
  Logger, 
  createCorsHeaders, 
  createJsonResponse, 
  createErrorResponse,
  PerformanceMonitor
} from '../_shared/utils.ts'
import { getCacheStats } from '../_shared/cache.ts'
import { dbOptimizer } from '../_shared/db-optimizer.ts'
import { requestOptimizer, memoryOptimizer } from '../_shared/request-optimizer.ts'

const logger = new Logger('PerformanceDashboard')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createCorsHeaders() })
  }

  const monitor = new PerformanceMonitor(logger)
  
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'overview'
    const timeframe = url.searchParams.get('timeframe') || '1h'
    
    logger.info('Performance dashboard request', { action, timeframe })

    const db = DatabaseService.create()
    monitor.mark('db_initialized')

    let result: any

    switch (action) {
      case 'overview':
        result = await getPerformanceOverview(db, timeframe)
        break
      case 'cache':
        result = getCachePerformance()
        break
      case 'database':
        result = getDatabasePerformance(timeframe)
        break
      case 'requests':
        result = getRequestPerformance()
        break
      case 'memory':
        result = getMemoryPerformance()
        break
      case 'optimization-suggestions':
        result = await getOptimizationSuggestions(db, timeframe)
        break
      case 'real-time':
        result = getRealTimeMetrics()
        break
      default:
        return createErrorResponse('Invalid action', 400, 'INVALID_ACTION')
    }

    monitor.mark('data_collected')

    const totalTime = monitor.getTotalTime()
    logger.info('Performance dashboard completed', {
      action,
      timeframe,
      total_time_ms: totalTime.toFixed(2)
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
    logger.error('Performance dashboard failed', error, { 
      total_time_ms: totalTime.toFixed(2) 
    })
    return createErrorResponse(
      'Performance dashboard failed',
      500,
      'DASHBOARD_ERROR'
    )
  }
})

// Get comprehensive performance overview
async function getPerformanceOverview(db: DatabaseService, timeframe: string): Promise<any> {
  const overview = {
    timestamp: new Date().toISOString(),
    timeframe,
    system_health: 'healthy',
    performance_score: 0,
    cache: getCachePerformance(),
    database: getDatabasePerformance(timeframe),
    requests: getRequestPerformance(),
    memory: getMemoryPerformance(),
    alerts: [] as any[]
  }

  // Calculate overall performance score (0-100)
  const cacheScore = Math.min(overview.cache.overall_hit_rate, 100)
  const dbScore = Math.max(0, 100 - (overview.database.average_query_time / 10)) // 1000ms = 0 score
  const memoryScore = Math.max(0, 100 - overview.memory.usage_percentage)
  
  overview.performance_score = Math.round((cacheScore + dbScore + memoryScore) / 3)

  // Determine system health
  if (overview.performance_score < 50) {
    overview.system_health = 'critical'
  } else if (overview.performance_score < 70) {
    overview.system_health = 'warning'
  } else if (overview.performance_score < 85) {
    overview.system_health = 'good'
  } else {
    overview.system_health = 'excellent'
  }

  // Generate alerts
  if (overview.cache.overall_hit_rate < 50) {
    overview.alerts.push({
      type: 'warning',
      category: 'cache',
      message: 'Low cache hit rate detected',
      value: `${overview.cache.overall_hit_rate.toFixed(1)}%`,
      threshold: '50%'
    })
  }

  if (overview.database.average_query_time > 1000) {
    overview.alerts.push({
      type: 'critical',
      category: 'database',
      message: 'High average query time detected',
      value: `${overview.database.average_query_time.toFixed(0)}ms`,
      threshold: '1000ms'
    })
  }

  if (overview.memory.usage_percentage > 80) {
    overview.alerts.push({
      type: 'warning',
      category: 'memory',
      message: 'High memory usage detected',
      value: `${overview.memory.usage_percentage.toFixed(1)}%`,
      threshold: '80%'
    })
  }

  return overview
}

// Get cache performance metrics
function getCachePerformance(): any {
  const cacheStats = getCacheStats()
  
  return {
    overall_hit_rate: cacheStats.total.overallHitRate,
    total_entries: cacheStats.total.totalEntries,
    total_hits: cacheStats.total.totalHits,
    total_misses: cacheStats.total.totalMisses,
    by_cache: {
      response: {
        hit_rate: cacheStats.response.hitRate,
        size: cacheStats.response.totalSize,
        hits: cacheStats.response.hits,
        misses: cacheStats.response.misses
      },
      user: {
        hit_rate: cacheStats.user.hitRate,
        size: cacheStats.user.totalSize,
        hits: cacheStats.user.hits,
        misses: cacheStats.user.misses
      },
      config: {
        hit_rate: cacheStats.config.hitRate,
        size: cacheStats.config.totalSize,
        hits: cacheStats.config.hits,
        misses: cacheStats.config.misses
      },
      rate_limit: {
        hit_rate: cacheStats.rateLimit.hitRate,
        size: cacheStats.rateLimit.totalSize,
        hits: cacheStats.rateLimit.hits,
        misses: cacheStats.rateLimit.misses
      }
    },
    recommendations: generateCacheRecommendations(cacheStats)
  }
}

// Get database performance metrics
function getDatabasePerformance(timeframe: string): any {
  const timeframeMs = parseTimeframe(timeframe)
  const analytics = dbOptimizer.getQueryAnalytics(timeframeMs)
  
  return {
    total_queries: analytics.totalQueries,
    average_query_time: analytics.averageExecutionTime,
    slow_queries_count: analytics.slowQueries.length,
    error_rate: analytics.errorRate,
    cache_hit_rate: analytics.cacheStats.hitRate,
    top_slow_queries: analytics.topSlowQueries.slice(0, 5),
    recent_slow_queries: analytics.slowQueries.slice(-10),
    recommendations: generateDatabaseRecommendations(analytics)
  }
}

// Get request performance metrics
function getRequestPerformance(): any {
  const requestStats = requestOptimizer.getStats()
  
  return {
    batcher: {
      pending_requests: requestStats.batcher.pendingRequests,
      queue_size: requestStats.batcher.queueSize,
      active_requests: requestStats.batcher.activeRequests
    },
    deduplicator: {
      hit_rate: requestStats.deduplicator.hitRate || 0,
      total_size: requestStats.deduplicator.totalSize || 0
    },
    response_cache: {
      hit_rate: requestStats.responseCache.hitRate,
      size: requestStats.responseCache.totalSize,
      hits: requestStats.responseCache.hits,
      misses: requestStats.responseCache.misses
    },
    recommendations: generateRequestRecommendations(requestStats)
  }
}

// Get memory performance metrics
function getMemoryPerformance(): any {
  const memoryStats = memoryOptimizer.getMemoryStats()
  
  return {
    used_mb: (memoryStats.used / 1024 / 1024).toFixed(2),
    total_mb: (memoryStats.total / 1024 / 1024).toFixed(2),
    usage_percentage: memoryStats.percentage.toFixed(1),
    threshold_mb: (memoryStats.threshold / 1024 / 1024).toFixed(2),
    recommendations: generateMemoryRecommendations(memoryStats)
  }
}

// Get optimization suggestions
async function getOptimizationSuggestions(db: DatabaseService, timeframe: string): Promise<any> {
  const suggestions = {
    high_priority: [] as any[],
    medium_priority: [] as any[],
    low_priority: [] as any[],
    implemented: [] as any[]
  }

  // Analyze cache performance
  const cacheStats = getCacheStats()
  if (cacheStats.total.overallHitRate < 60) {
    suggestions.high_priority.push({
      category: 'cache',
      title: 'Improve Cache Hit Rate',
      description: 'Cache hit rate is below optimal threshold',
      impact: 'high',
      effort: 'medium',
      actions: [
        'Increase cache TTL for stable data',
        'Implement cache warming for frequently accessed data',
        'Review cache key strategies for better reuse'
      ]
    })
  }

  // Analyze database performance
  const timeframeMs = parseTimeframe(timeframe)
  const dbAnalytics = dbOptimizer.getQueryAnalytics(timeframeMs)
  
  if (dbAnalytics.averageExecutionTime > 500) {
    suggestions.high_priority.push({
      category: 'database',
      title: 'Optimize Database Queries',
      description: 'Average query time exceeds recommended threshold',
      impact: 'high',
      effort: 'high',
      actions: [
        'Add database indexes for frequently queried columns',
        'Implement query result caching',
        'Optimize slow queries identified in analytics',
        'Consider database connection pooling'
      ]
    })
  }

  if (dbAnalytics.slowQueries.length > 10) {
    suggestions.medium_priority.push({
      category: 'database',
      title: 'Address Slow Queries',
      description: `${dbAnalytics.slowQueries.length} slow queries detected`,
      impact: 'medium',
      effort: 'medium',
      actions: [
        'Review and optimize identified slow queries',
        'Add appropriate database indexes',
        'Consider query restructuring'
      ]
    })
  }

  // Analyze memory usage
  const memoryStats = memoryOptimizer.getMemoryStats()
  if (memoryStats.percentage > 75) {
    suggestions.medium_priority.push({
      category: 'memory',
      title: 'Optimize Memory Usage',
      description: 'Memory usage is approaching limits',
      impact: 'medium',
      effort: 'low',
      actions: [
        'Implement more aggressive cache cleanup',
        'Reduce cache sizes if hit rates are low',
        'Review data structures for memory efficiency'
      ]
    })
  }

  // Request optimization suggestions
  const requestStats = requestOptimizer.getStats()
  if (requestStats.batcher.queueSize > 50) {
    suggestions.low_priority.push({
      category: 'requests',
      title: 'Optimize Request Batching',
      description: 'Large request queue detected',
      impact: 'low',
      effort: 'low',
      actions: [
        'Increase batch processing concurrency',
        'Reduce batch timeout for faster processing',
        'Review request prioritization'
      ]
    })
  }

  return suggestions
}

// Get real-time metrics
function getRealTimeMetrics(): any {
  return {
    timestamp: new Date().toISOString(),
    cache: {
      hit_rate: getCacheStats().total.overallHitRate,
      total_entries: getCacheStats().total.totalEntries
    },
    database: {
      cache_hit_rate: dbOptimizer.getCacheStats().hitRate,
      cache_size: dbOptimizer.getCacheStats().totalSize
    },
    requests: {
      active: requestOptimizer.getStats().batcher.activeRequests,
      queued: requestOptimizer.getStats().batcher.queueSize
    },
    memory: {
      usage_percentage: memoryOptimizer.getMemoryStats().percentage,
      used_mb: (memoryOptimizer.getMemoryStats().used / 1024 / 1024).toFixed(2)
    }
  }
}

// Helper functions
function parseTimeframe(timeframe: string): number {
  const timeframeMap: Record<string, number> = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  }
  return timeframeMap[timeframe] || timeframeMap['1h']
}

function generateCacheRecommendations(cacheStats: any): string[] {
  const recommendations = []
  
  if (cacheStats.total.overallHitRate < 50) {
    recommendations.push('Consider increasing cache TTL for stable data')
    recommendations.push('Implement cache warming for frequently accessed data')
  }
  
  if (cacheStats.response.hitRate < 40) {
    recommendations.push('Review response caching strategy')
  }
  
  if (cacheStats.user.hitRate < 60) {
    recommendations.push('Optimize user data caching patterns')
  }
  
  return recommendations
}

function generateDatabaseRecommendations(analytics: any): string[] {
  const recommendations = []
  
  if (analytics.averageExecutionTime > 1000) {
    recommendations.push('Critical: Add database indexes for slow queries')
    recommendations.push('Consider query optimization or restructuring')
  }
  
  if (analytics.errorRate > 5) {
    recommendations.push('Investigate and fix database errors')
  }
  
  if (analytics.cacheStats.hitRate < 30) {
    recommendations.push('Increase database query result caching')
  }
  
  return recommendations
}

function generateRequestRecommendations(requestStats: any): string[] {
  const recommendations = []
  
  if (requestStats.batcher.queueSize > 20) {
    recommendations.push('Consider increasing request processing concurrency')
  }
  
  if (requestStats.responseCache.hitRate < 30) {
    recommendations.push('Improve response caching strategy')
  }
  
  return recommendations
}

function generateMemoryRecommendations(memoryStats: any): string[] {
  const recommendations = []
  
  if (memoryStats.percentage > 80) {
    recommendations.push('Critical: Implement memory cleanup strategies')
    recommendations.push('Consider reducing cache sizes')
  } else if (memoryStats.percentage > 60) {
    recommendations.push('Monitor memory usage closely')
    recommendations.push('Consider proactive cleanup')
  }
  
  return recommendations
}