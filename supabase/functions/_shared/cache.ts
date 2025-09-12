/**
 * High-performance caching system for Supabase Edge Functions
 * Provides in-memory caching with TTL, LRU eviction, and performance monitoring
 */

import { Logger } from './utils.ts'

const logger = new Logger('Cache')

export interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum number of entries
  enableMetrics?: boolean // Enable performance metrics
}

export interface CacheEntry<T> {
  value: T
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
}

export interface CacheMetrics {
  hits: number
  misses: number
  sets: number
  deletes: number
  evictions: number
  totalSize: number
  hitRate: number
  averageAccessTime: number
}

export class PerformanceCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    totalSize: 0,
    hitRate: 0,
    averageAccessTime: 0
  }
  private accessTimes: number[] = []
  private readonly maxSize: number
  private readonly defaultTtl: number
  private readonly enableMetrics: boolean

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000
    this.defaultTtl = options.ttl || 300000 // 5 minutes default
    this.enableMetrics = options.enableMetrics ?? true

    // Start cleanup interval
    this.startCleanupInterval()
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const startTime = performance.now()
    
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.recordMiss()
      return null
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key)
      this.recordMiss()
      return null
    }

    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = Date.now()
    
    this.recordHit()
    this.recordAccessTime(performance.now() - startTime)
    
    return entry.value
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    const now = Date.now()
    const entryTtl = ttl || this.defaultTtl

    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      ttl: entryTtl,
      accessCount: 0,
      lastAccessed: now
    }

    this.cache.set(key, entry)
    this.recordSet()
    
    logger.debug('Cache set', { key, ttl: entryTtl, size: this.cache.size })
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.recordDelete()
    }
    return deleted
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.resetMetrics()
    logger.debug('Cache cleared')
  }

  /**
   * Get cache statistics
   */
  getMetrics(): CacheMetrics {
    this.updateMetrics()
    return { ...this.metrics }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    
    if (this.isExpired(entry)) {
      this.cache.delete(key)
      return false
    }
    
    return true
  }

  /**
   * Get all keys (non-expired)
   */
  keys(): string[] {
    const validKeys: string[] = []
    
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isExpired(entry)) {
        validKeys.push(key)
      } else {
        this.cache.delete(key)
      }
    }
    
    return validKeys
  }

  /**
   * Get or set pattern - fetch value if not in cache
   */
  async getOrSet<R>(
    key: string, 
    fetcher: () => Promise<R>, 
    ttl?: number
  ): Promise<R> {
    const cached = this.get(key)
    if (cached !== null) {
      return cached as R
    }

    const value = await fetcher()
    this.set(key, value as T, ttl)
    return value
  }

  /**
   * Batch get multiple keys
   */
  mget(keys: string[]): Map<string, T> {
    const results = new Map<string, T>()
    
    for (const key of keys) {
      const value = this.get(key)
      if (value !== null) {
        results.set(key, value)
      }
    }
    
    return results
  }

  /**
   * Batch set multiple key-value pairs
   */
  mset(entries: Map<string, T>, ttl?: number): void {
    for (const [key, value] of entries.entries()) {
      this.set(key, value, ttl)
    }
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.recordEviction()
      logger.debug('LRU eviction', { key: oldestKey })
    }
  }

  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup()
    }, 300000)
  }

  private cleanup(): void {
    const before = this.cache.size
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug('Cache cleanup', { 
        before, 
        after: this.cache.size, 
        cleaned 
      })
    }
  }

  private recordHit(): void {
    if (this.enableMetrics) {
      this.metrics.hits++
    }
  }

  private recordMiss(): void {
    if (this.enableMetrics) {
      this.metrics.misses++
    }
  }

  private recordSet(): void {
    if (this.enableMetrics) {
      this.metrics.sets++
    }
  }

  private recordDelete(): void {
    if (this.enableMetrics) {
      this.metrics.deletes++
    }
  }

  private recordEviction(): void {
    if (this.enableMetrics) {
      this.metrics.evictions++
    }
  }

  private recordAccessTime(time: number): void {
    if (this.enableMetrics) {
      this.accessTimes.push(time)
      // Keep only last 1000 access times for average calculation
      if (this.accessTimes.length > 1000) {
        this.accessTimes = this.accessTimes.slice(-1000)
      }
    }
  }

  private updateMetrics(): void {
    if (!this.enableMetrics) return

    this.metrics.totalSize = this.cache.size
    
    const totalRequests = this.metrics.hits + this.metrics.misses
    this.metrics.hitRate = totalRequests > 0 
      ? (this.metrics.hits / totalRequests) * 100 
      : 0

    this.metrics.averageAccessTime = this.accessTimes.length > 0
      ? this.accessTimes.reduce((a, b) => a + b, 0) / this.accessTimes.length
      : 0
  }

  private resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      totalSize: 0,
      hitRate: 0,
      averageAccessTime: 0
    }
    this.accessTimes = []
  }
}

// Global cache instances for different use cases
export const responseCache = new PerformanceCache<any>({
  ttl: 300000, // 5 minutes
  maxSize: 500,
  enableMetrics: true
})

export const userCache = new PerformanceCache<any>({
  ttl: 900000, // 15 minutes
  maxSize: 1000,
  enableMetrics: true
})

export const configCache = new PerformanceCache<any>({
  ttl: 3600000, // 1 hour
  maxSize: 100,
  enableMetrics: true
})

export const rateLimitCache = new PerformanceCache<any>({
  ttl: 60000, // 1 minute
  maxSize: 10000,
  enableMetrics: true
})

/**
 * Cache decorator for functions
 */
export function cached<T extends (...args: any[]) => Promise<any>>(
  cache: PerformanceCache<any>,
  keyGenerator: (...args: Parameters<T>) => string,
  ttl?: number
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: Parameters<T>) {
      const key = keyGenerator(...args)
      
      return await cache.getOrSet(
        key,
        () => method.apply(this, args),
        ttl
      )
    }

    return descriptor
  }
}

/**
 * Memoization decorator with automatic cache key generation
 */
export function memoize<T extends (...args: any[]) => Promise<any>>(
  ttl: number = 300000,
  maxSize: number = 100
) {
  const cache = new PerformanceCache<any>({ ttl, maxSize })

  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: Parameters<T>) {
      const key = `${propertyName}:${JSON.stringify(args)}`
      
      return await cache.getOrSet(
        key,
        () => method.apply(this, args)
      )
    }

    return descriptor
  }
}

/**
 * Cache warming utility
 */
export class CacheWarmer {
  private warmupTasks: Array<{
    key: string
    fetcher: () => Promise<any>
    cache: PerformanceCache<any>
    ttl?: number
    interval?: number
  }> = []

  addWarmupTask<T>(
    key: string,
    fetcher: () => Promise<T>,
    cache: PerformanceCache<T>,
    options: { ttl?: number; interval?: number } = {}
  ): void {
    this.warmupTasks.push({
      key,
      fetcher,
      cache,
      ttl: options.ttl,
      interval: options.interval
    })
  }

  async warmup(): Promise<void> {
    logger.info('Starting cache warmup', { tasks: this.warmupTasks.length })

    const promises = this.warmupTasks.map(async (task) => {
      try {
        const value = await task.fetcher()
        task.cache.set(task.key, value, task.ttl)
        
        // Set up periodic refresh if interval specified
        if (task.interval) {
          setInterval(async () => {
            try {
              const refreshedValue = await task.fetcher()
              task.cache.set(task.key, refreshedValue, task.ttl)
            } catch (error) {
              logger.warn('Cache refresh failed', error, { key: task.key })
            }
          }, task.interval)
        }
        
        logger.debug('Cache warmed', { key: task.key })
      } catch (error) {
        logger.warn('Cache warmup failed', error, { key: task.key })
      }
    })

    await Promise.all(promises)
    logger.info('Cache warmup completed')
  }
}

/**
 * Cache statistics aggregator
 */
export function getCacheStats(): {
  response: CacheMetrics
  user: CacheMetrics
  config: CacheMetrics
  rateLimit: CacheMetrics
  total: {
    totalEntries: number
    totalHits: number
    totalMisses: number
    overallHitRate: number
  }
} {
  const responseStats = responseCache.getMetrics()
  const userStats = userCache.getMetrics()
  const configStats = configCache.getMetrics()
  const rateLimitStats = rateLimitCache.getMetrics()

  const totalHits = responseStats.hits + userStats.hits + configStats.hits + rateLimitStats.hits
  const totalMisses = responseStats.misses + userStats.misses + configStats.misses + rateLimitStats.misses
  const totalRequests = totalHits + totalMisses

  return {
    response: responseStats,
    user: userStats,
    config: configStats,
    rateLimit: rateLimitStats,
    total: {
      totalEntries: responseStats.totalSize + userStats.totalSize + configStats.totalSize + rateLimitStats.totalSize,
      totalHits,
      totalMisses,
      overallHitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0
    }
  }
}