/**
 * Database optimization utilities for Supabase Edge Functions
 * Provides connection pooling, query optimization, and performance monitoring
 */

import { Logger } from './utils.ts'
import { PerformanceCache } from './cache.ts'

const logger = new Logger('DBOptimizer')

export interface QueryMetrics {
  query: string
  executionTime: number
  timestamp: number
  success: boolean
  rowCount?: number
  error?: string
}

export interface ConnectionPoolOptions {
  maxConnections?: number
  idleTimeout?: number
  connectionTimeout?: number
  retryAttempts?: number
  retryDelay?: number
}

export class DatabaseOptimizer {
  private queryCache = new PerformanceCache<any>({
    ttl: 300000, // 5 minutes
    maxSize: 1000,
    enableMetrics: true
  })
  
  private queryMetrics: QueryMetrics[] = []
  private slowQueryThreshold = 1000 // 1 second
  private maxMetricsHistory = 10000

  constructor() {
    // Start periodic cleanup
    this.startMetricsCleanup()
  }

  /**
   * Execute optimized query with caching and metrics
   */
  async executeQuery<T>(
    supabase: any,
    queryBuilder: any,
    options: {
      cacheKey?: string
      cacheTtl?: number
      enableCache?: boolean
      timeout?: number
    } = {}
  ): Promise<{ data: T[] | null; error: any; metrics: QueryMetrics }> {
    const startTime = performance.now()
    const queryString = this.extractQueryString(queryBuilder)
    
    // Check cache first if enabled
    if (options.enableCache && options.cacheKey) {
      const cached = this.queryCache.get(options.cacheKey)
      if (cached) {
        logger.debug('Query cache hit', { cacheKey: options.cacheKey })
        return {
          data: cached.data,
          error: cached.error,
          metrics: {
            query: queryString,
            executionTime: 0,
            timestamp: Date.now(),
            success: !cached.error,
            rowCount: cached.data?.length
          }
        }
      }
    }

    let result: { data: T[] | null; error: any }
    let executionTime: number

    try {
      // Apply timeout if specified
      if (options.timeout) {
        result = await this.withTimeout(queryBuilder, options.timeout)
      } else {
        result = await queryBuilder
      }
      
      executionTime = performance.now() - startTime
      
      // Cache successful results
      if (options.enableCache && options.cacheKey && !result.error) {
        this.queryCache.set(options.cacheKey, result, options.cacheTtl)
      }

    } catch (error) {
      executionTime = performance.now() - startTime
      result = { data: null, error }
    }

    // Record metrics
    const metrics: QueryMetrics = {
      query: queryString,
      executionTime,
      timestamp: Date.now(),
      success: !result.error,
      rowCount: result.data?.length,
      error: result.error?.message
    }

    this.recordQueryMetrics(metrics)

    // Log slow queries
    if (executionTime > this.slowQueryThreshold) {
      logger.warn('Slow query detected', {
        query: queryString,
        executionTime: `${executionTime.toFixed(2)}ms`,
        rowCount: result.data?.length
      })
    }

    return { ...result, metrics }
  }

  /**
   * Batch execute multiple queries with optimization
   */
  async executeBatch<T>(
    queries: Array<{
      queryBuilder: any
      cacheKey?: string
      cacheTtl?: number
    }>,
    options: {
      concurrency?: number
      failFast?: boolean
    } = {}
  ): Promise<Array<{ data: T[] | null; error: any; metrics: QueryMetrics }>> {
    const { concurrency = 5, failFast = false } = options
    const results: Array<{ data: T[] | null; error: any; metrics: QueryMetrics }> = []

    // Process queries in batches to control concurrency
    for (let i = 0; i < queries.length; i += concurrency) {
      const batch = queries.slice(i, i + concurrency)
      
      const batchPromises = batch.map(async (query) => {
        try {
          return await this.executeQuery(null, query.queryBuilder, {
            cacheKey: query.cacheKey,
            cacheTtl: query.cacheTtl,
            enableCache: !!query.cacheKey
          })
        } catch (error) {
          if (failFast) throw error
          return {
            data: null,
            error,
            metrics: {
              query: 'batch_query',
              executionTime: 0,
              timestamp: Date.now(),
              success: false,
              error: error.message
            }
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Check for failures in fail-fast mode
      if (failFast && batchResults.some(r => r.error)) {
        break
      }
    }

    return results
  }

  /**
   * Get query performance analytics
   */
  getQueryAnalytics(timeframe: number = 3600000): {
    totalQueries: number
    averageExecutionTime: number
    slowQueries: QueryMetrics[]
    errorRate: number
    topSlowQueries: Array<{ query: string; avgTime: number; count: number }>
    cacheStats: any
  } {
    const cutoff = Date.now() - timeframe
    const recentMetrics = this.queryMetrics.filter(m => m.timestamp > cutoff)

    const totalQueries = recentMetrics.length
    const successfulQueries = recentMetrics.filter(m => m.success)
    const failedQueries = recentMetrics.filter(m => !m.success)
    const slowQueries = recentMetrics.filter(m => m.executionTime > this.slowQueryThreshold)

    const averageExecutionTime = totalQueries > 0
      ? recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries
      : 0

    const errorRate = totalQueries > 0
      ? (failedQueries.length / totalQueries) * 100
      : 0

    // Aggregate slow queries by query pattern
    const queryStats = new Map<string, { totalTime: number; count: number }>()
    
    slowQueries.forEach(metric => {
      const normalizedQuery = this.normalizeQuery(metric.query)
      const existing = queryStats.get(normalizedQuery) || { totalTime: 0, count: 0 }
      existing.totalTime += metric.executionTime
      existing.count += 1
      queryStats.set(normalizedQuery, existing)
    })

    const topSlowQueries = Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        avgTime: stats.totalTime / stats.count,
        count: stats.count
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10)

    return {
      totalQueries,
      averageExecutionTime,
      slowQueries: slowQueries.slice(-50), // Last 50 slow queries
      errorRate,
      topSlowQueries,
      cacheStats: this.queryCache.getMetrics()
    }
  }

  /**
   * Optimize query builder with best practices
   */
  optimizeQuery(queryBuilder: any, options: {
    selectFields?: string[]
    limit?: number
    useIndex?: string
    enableCount?: boolean
  } = {}): any {
    let optimized = queryBuilder

    // Limit selected fields to reduce data transfer
    if (options.selectFields && options.selectFields.length > 0) {
      optimized = optimized.select(options.selectFields.join(','))
    }

    // Apply reasonable limit if not set
    if (options.limit && options.limit > 0) {
      optimized = optimized.limit(options.limit)
    }

    // Add index hints if supported
    if (options.useIndex) {
      // This would be database-specific implementation
      logger.debug('Index hint applied', { index: options.useIndex })
    }

    return optimized
  }

  /**
   * Create optimized pagination
   */
  createPaginatedQuery(
    baseQuery: any,
    page: number,
    pageSize: number,
    options: {
      orderBy?: string
      orderDirection?: 'asc' | 'desc'
      countTotal?: boolean
    } = {}
  ): {
    query: any
    countQuery?: any
    offset: number
    limit: number
  } {
    const offset = (page - 1) * pageSize
    const { orderBy = 'created_at', orderDirection = 'desc' } = options

    let query = baseQuery
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(offset, offset + pageSize - 1)

    let countQuery
    if (options.countTotal) {
      countQuery = baseQuery.select('*', { count: 'exact', head: true })
    }

    return {
      query,
      countQuery,
      offset,
      limit: pageSize
    }
  }

  /**
   * Bulk insert with optimization
   */
  async bulkInsert<T>(
    supabase: any,
    table: string,
    data: T[],
    options: {
      batchSize?: number
      onConflict?: string
      returning?: string
    } = {}
  ): Promise<{ success: boolean; insertedCount: number; errors: any[] }> {
    const { batchSize = 1000, onConflict, returning } = options
    const errors: any[] = []
    let insertedCount = 0

    // Process in batches to avoid memory issues
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)
      
      try {
        let query = supabase.from(table).insert(batch)
        
        if (onConflict) {
          query = query.onConflict(onConflict)
        }
        
        if (returning) {
          query = query.select(returning)
        }

        const result = await this.executeQuery(supabase, query, {
          enableCache: false
        })

        if (result.error) {
          errors.push({
            batch: i / batchSize + 1,
            error: result.error,
            data: batch
          })
        } else {
          insertedCount += batch.length
        }

      } catch (error) {
        errors.push({
          batch: i / batchSize + 1,
          error,
          data: batch
        })
      }
    }

    return {
      success: errors.length === 0,
      insertedCount,
      errors
    }
  }

  /**
   * Connection health check
   */
  async healthCheck(supabase: any): Promise<{
    healthy: boolean
    responseTime: number
    error?: string
  }> {
    const startTime = performance.now()
    
    try {
      const result = await this.executeQuery(
        supabase,
        supabase.from('projects').select('count', { count: 'exact', head: true }),
        { enableCache: false, timeout: 5000 }
      )

      const responseTime = performance.now() - startTime

      return {
        healthy: !result.error,
        responseTime,
        error: result.error?.message
      }

    } catch (error) {
      return {
        healthy: false,
        responseTime: performance.now() - startTime,
        error: error.message
      }
    }
  }

  /**
   * Clear query cache
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      const keys = this.queryCache.keys()
      const matchingKeys = keys.filter(key => key.includes(pattern))
      matchingKeys.forEach(key => this.queryCache.delete(key))
      logger.info('Cache cleared by pattern', { pattern, cleared: matchingKeys.length })
    } else {
      this.queryCache.clear()
      logger.info('All cache cleared')
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    return this.queryCache.getMetrics()
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
    })

    return Promise.race([promise, timeoutPromise])
  }

  private recordQueryMetrics(metrics: QueryMetrics): void {
    this.queryMetrics.push(metrics)
    
    // Keep metrics history within limits
    if (this.queryMetrics.length > this.maxMetricsHistory) {
      this.queryMetrics = this.queryMetrics.slice(-this.maxMetricsHistory * 0.8)
    }
  }

  private extractQueryString(queryBuilder: any): string {
    // This is a simplified extraction - in practice, you'd need to
    // implement proper query string extraction based on the query builder
    try {
      return queryBuilder.toString() || 'unknown_query'
    } catch {
      return 'unknown_query'
    }
  }

  private normalizeQuery(query: string): string {
    // Normalize query by removing specific values and keeping structure
    return query
      .replace(/\b\d+\b/g, '?') // Replace numbers with placeholders
      .replace(/'[^']*'/g, '?') // Replace string literals
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  private startMetricsCleanup(): void {
    // Clean up old metrics every hour
    setInterval(() => {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000 // 24 hours
      const before = this.queryMetrics.length
      this.queryMetrics = this.queryMetrics.filter(m => m.timestamp > cutoff)
      
      if (before > this.queryMetrics.length) {
        logger.debug('Metrics cleanup', {
          before,
          after: this.queryMetrics.length,
          removed: before - this.queryMetrics.length
        })
      }
    }, 3600000) // 1 hour
  }
}

// Global database optimizer instance
export const dbOptimizer = new DatabaseOptimizer()

/**
 * Database query decorator with automatic optimization
 */
export function optimizedQuery(options: {
  cache?: boolean
  cacheTtl?: number
  timeout?: number
  selectFields?: string[]
  limit?: number
} = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const queryBuilder = method.apply(this, args)
      
      // Apply optimizations
      const optimized = dbOptimizer.optimizeQuery(queryBuilder, {
        selectFields: options.selectFields,
        limit: options.limit
      })

      // Execute with optimization
      const cacheKey = options.cache 
        ? `${propertyName}:${JSON.stringify(args)}`
        : undefined

      const result = await dbOptimizer.executeQuery(null, optimized, {
        cacheKey,
        cacheTtl: options.cacheTtl,
        enableCache: options.cache,
        timeout: options.timeout
      })

      return result
    }

    return descriptor
  }
}

/**
 * Connection pool manager (simplified for Edge Functions)
 */
export class ConnectionManager {
  private connections = new Map<string, any>()
  private connectionMetrics = new Map<string, {
    created: number
    lastUsed: number
    queryCount: number
  }>()

  getConnection(key: string = 'default'): any {
    const existing = this.connections.get(key)
    if (existing) {
      const metrics = this.connectionMetrics.get(key)!
      metrics.lastUsed = Date.now()
      metrics.queryCount++
      return existing
    }

    // In Edge Functions, we don't actually pool connections
    // This is more of a connection tracking mechanism
    logger.debug('New connection requested', { key })
    return null
  }

  releaseConnection(key: string = 'default'): void {
    // In Edge Functions, connections are automatically managed
    logger.debug('Connection released', { key })
  }

  getConnectionStats(): Array<{
    key: string
    created: number
    lastUsed: number
    queryCount: number
    age: number
  }> {
    return Array.from(this.connectionMetrics.entries()).map(([key, metrics]) => ({
      key,
      created: metrics.created,
      lastUsed: metrics.lastUsed,
      queryCount: metrics.queryCount,
      age: Date.now() - metrics.created
    }))
  }
}

export const connectionManager = new ConnectionManager()