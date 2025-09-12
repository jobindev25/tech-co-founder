/**
 * Request optimization utilities for Supabase Edge Functions
 * Provides request batching, deduplication, and performance optimization
 */

import { Logger } from './utils.ts'
import { PerformanceCache } from './cache.ts'

const logger = new Logger('RequestOptimizer')

export interface BatchRequest {
  id: string
  url: string
  options: RequestInit
  resolve: (response: Response) => void
  reject: (error: Error) => void
  timestamp: number
  priority: number
}

export interface RequestBatchOptions {
  maxBatchSize?: number
  batchTimeout?: number
  maxConcurrency?: number
  retryAttempts?: number
  retryDelay?: number
}

export class RequestBatcher {
  private pendingRequests = new Map<string, BatchRequest>()
  private batchTimer: number | null = null
  private activeRequests = 0
  private requestQueue: BatchRequest[] = []
  
  private readonly maxBatchSize: number
  private readonly batchTimeout: number
  private readonly maxConcurrency: number
  private readonly retryAttempts: number
  private readonly retryDelay: number

  constructor(options: RequestBatchOptions = {}) {
    this.maxBatchSize = options.maxBatchSize || 10
    this.batchTimeout = options.batchTimeout || 100 // 100ms
    this.maxConcurrency = options.maxConcurrency || 5
    this.retryAttempts = options.retryAttempts || 3
    this.retryDelay = options.retryDelay || 1000
  }

  /**
   * Add request to batch
   */
  async batchRequest(
    url: string, 
    options: RequestInit = {}, 
    priority: number = 0
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const id = this.generateRequestId(url, options)
      
      // Check for duplicate request
      const existing = this.pendingRequests.get(id)
      if (existing) {
        logger.debug('Duplicate request detected, reusing', { id, url })
        // Attach to existing request
        const originalResolve = existing.resolve
        existing.resolve = (response: Response) => {
          originalResolve(response.clone())
          resolve(response.clone())
        }
        return
      }

      const request: BatchRequest = {
        id,
        url,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
        priority
      }

      this.pendingRequests.set(id, request)
      this.requestQueue.push(request)

      // Sort queue by priority
      this.requestQueue.sort((a, b) => b.priority - a.priority)

      // Schedule batch processing
      this.scheduleBatch()
    })
  }

  /**
   * Process batch of requests
   */
  private async processBatch(): Promise<void> {
    if (this.requestQueue.length === 0 || this.activeRequests >= this.maxConcurrency) {
      return
    }

    const batchSize = Math.min(
      this.maxBatchSize, 
      this.requestQueue.length,
      this.maxConcurrency - this.activeRequests
    )

    const batch = this.requestQueue.splice(0, batchSize)
    this.activeRequests += batch.length

    logger.debug('Processing request batch', { 
      batchSize: batch.length, 
      queueSize: this.requestQueue.length,
      activeRequests: this.activeRequests
    })

    // Process requests concurrently
    const promises = batch.map(request => this.executeRequest(request))
    await Promise.allSettled(promises)

    this.activeRequests -= batch.length

    // Process next batch if queue not empty
    if (this.requestQueue.length > 0) {
      setImmediate(() => this.processBatch())
    }
  }

  /**
   * Execute individual request with retry logic
   */
  private async executeRequest(request: BatchRequest): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(request.url, request.options)
        
        this.pendingRequests.delete(request.id)
        request.resolve(response)
        return

      } catch (error) {
        lastError = error as Error
        
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt)
          logger.debug('Request failed, retrying', { 
            id: request.id, 
            attempt: attempt + 1, 
            delay 
          })
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // All retries failed
    this.pendingRequests.delete(request.id)
    request.reject(lastError || new Error('Request failed after all retries'))
  }

  private scheduleBatch(): void {
    if (this.batchTimer !== null) {
      return
    }

    this.batchTimer = setTimeout(() => {
      this.batchTimer = null
      this.processBatch()
    }, this.batchTimeout)
  }

  private generateRequestId(url: string, options: RequestInit): string {
    const key = `${options.method || 'GET'}:${url}:${JSON.stringify(options.body || '')}`
    return btoa(key).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)
  }

  /**
   * Get batch statistics
   */
  getStats(): {
    pendingRequests: number
    queueSize: number
    activeRequests: number
  } {
    return {
      pendingRequests: this.pendingRequests.size,
      queueSize: this.requestQueue.length,
      activeRequests: this.activeRequests
    }
  }
}

/**
 * Request deduplication cache
 */
export class RequestDeduplicator {
  private cache = new PerformanceCache<Promise<Response>>({
    ttl: 30000, // 30 seconds
    maxSize: 1000,
    enableMetrics: true
  })

  /**
   * Deduplicate identical requests
   */
  async deduplicate(
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    const key = this.generateKey(url, options)
    
    return await this.cache.getOrSet(
      key,
      () => fetch(url, options)
    )
  }

  private generateKey(url: string, options: RequestInit): string {
    const method = options.method || 'GET'
    const headers = JSON.stringify(options.headers || {})
    const body = options.body ? JSON.stringify(options.body) : ''
    
    return `${method}:${url}:${headers}:${body}`
  }

  getStats(): any {
    return this.cache.getMetrics()
  }
}

/**
 * Response compression utility
 */
export class ResponseCompressor {
  /**
   * Compress response data
   */
  static async compress(data: any, type: 'gzip' | 'deflate' = 'gzip'): Promise<Uint8Array> {
    const jsonString = JSON.stringify(data)
    const encoder = new TextEncoder()
    const input = encoder.encode(jsonString)

    const compressionStream = new CompressionStream(type)
    const writer = compressionStream.writable.getWriter()
    const reader = compressionStream.readable.getReader()

    writer.write(input)
    writer.close()

    const chunks: Uint8Array[] = []
    let done = false

    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        chunks.push(value)
      }
    }

    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0

    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result
  }

  /**
   * Decompress response data
   */
  static async decompress(
    compressedData: Uint8Array, 
    type: 'gzip' | 'deflate' = 'gzip'
  ): Promise<any> {
    const decompressionStream = new DecompressionStream(type)
    const writer = decompressionStream.writable.getWriter()
    const reader = decompressionStream.readable.getReader()

    writer.write(compressedData)
    writer.close()

    const chunks: Uint8Array[] = []
    let done = false

    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        chunks.push(value)
      }
    }

    // Combine chunks and decode
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0

    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    const decoder = new TextDecoder()
    const jsonString = decoder.decode(result)
    return JSON.parse(jsonString)
  }

  /**
   * Create compressed response
   */
  static createCompressedResponse(
    data: any, 
    options: ResponseInit = {}
  ): Response {
    const jsonString = JSON.stringify(data)
    
    // Only compress if data is large enough to benefit
    if (jsonString.length < 1024) {
      return new Response(jsonString, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      })
    }

    // For now, return uncompressed (compression would need to be async)
    return new Response(jsonString, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'identity',
        ...options.headers
      }
    })
  }
}

/**
 * Request optimization middleware
 */
export class RequestOptimizer {
  private batcher: RequestBatcher
  private deduplicator: RequestDeduplicator
  private responseCache = new PerformanceCache<Response>({
    ttl: 300000, // 5 minutes
    maxSize: 500,
    enableMetrics: true
  })

  constructor(options: RequestBatchOptions = {}) {
    this.batcher = new RequestBatcher(options)
    this.deduplicator = new RequestDeduplicator()
  }

  /**
   * Optimized fetch with batching, deduplication, and caching
   */
  async fetch(
    url: string, 
    options: RequestInit = {},
    optimizations: {
      enableBatching?: boolean
      enableDeduplication?: boolean
      enableCaching?: boolean
      cacheKey?: string
      cacheTtl?: number
      priority?: number
    } = {}
  ): Promise<Response> {
    const {
      enableBatching = true,
      enableDeduplication = true,
      enableCaching = false,
      cacheKey,
      cacheTtl,
      priority = 0
    } = optimizations

    // Check cache first
    if (enableCaching && cacheKey) {
      const cached = this.responseCache.get(cacheKey)
      if (cached) {
        logger.debug('Response cache hit', { cacheKey })
        return cached.clone()
      }
    }

    let response: Response

    // Apply optimizations based on configuration
    if (enableBatching && enableDeduplication) {
      // Use both batching and deduplication
      response = await this.batcher.batchRequest(url, options, priority)
    } else if (enableDeduplication) {
      // Use only deduplication
      response = await this.deduplicator.deduplicate(url, options)
    } else if (enableBatching) {
      // Use only batching
      response = await this.batcher.batchRequest(url, options, priority)
    } else {
      // No optimization
      response = await fetch(url, options)
    }

    // Cache successful responses
    if (enableCaching && cacheKey && response.ok) {
      this.responseCache.set(cacheKey, response.clone(), cacheTtl)
    }

    return response
  }

  /**
   * Batch multiple requests
   */
  async batchFetch(
    requests: Array<{
      url: string
      options?: RequestInit
      priority?: number
    }>
  ): Promise<Response[]> {
    const promises = requests.map(req => 
      this.batcher.batchRequest(req.url, req.options || {}, req.priority || 0)
    )

    return Promise.all(promises)
  }

  /**
   * Get optimization statistics
   */
  getStats(): {
    batcher: any
    deduplicator: any
    responseCache: any
  } {
    return {
      batcher: this.batcher.getStats(),
      deduplicator: this.deduplicator.getStats(),
      responseCache: this.responseCache.getMetrics()
    }
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.responseCache.clear()
    logger.info('Request optimizer caches cleared')
  }
}

/**
 * Memory usage optimizer
 */
export class MemoryOptimizer {
  private memoryThreshold = 50 * 1024 * 1024 // 50MB
  private checkInterval = 30000 // 30 seconds
  private cleanupCallbacks: Array<() => void> = []

  constructor() {
    this.startMemoryMonitoring()
  }

  /**
   * Register cleanup callback
   */
  registerCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback)
  }

  /**
   * Force memory cleanup
   */
  cleanup(): void {
    logger.info('Performing memory cleanup')
    
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback()
      } catch (error) {
        logger.warn('Cleanup callback failed', error)
      }
    })

    // Force garbage collection if available
    if (typeof (globalThis as any).gc === 'function') {
      (globalThis as any).gc()
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    used: number
    total: number
    percentage: number
    threshold: number
  } {
    const memory = (performance as any).memory
    
    if (!memory) {
      return {
        used: 0,
        total: 0,
        percentage: 0,
        threshold: this.memoryThreshold
      }
    }

    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
      threshold: this.memoryThreshold
    }
  }

  private startMemoryMonitoring(): void {
    setInterval(() => {
      const stats = this.getMemoryStats()
      
      if (stats.used > this.memoryThreshold) {
        logger.warn('Memory threshold exceeded, triggering cleanup', {
          used: `${(stats.used / 1024 / 1024).toFixed(2)}MB`,
          threshold: `${(this.memoryThreshold / 1024 / 1024).toFixed(2)}MB`
        })
        this.cleanup()
      }
    }, this.checkInterval)
  }
}

// Global instances
export const requestOptimizer = new RequestOptimizer()
export const memoryOptimizer = new MemoryOptimizer()

// Register memory cleanup for caches
memoryOptimizer.registerCleanup(() => {
  requestOptimizer.clearCaches()
})

/**
 * Performance monitoring decorator
 */
export function monitored(
  target: any, 
  propertyName: string, 
  descriptor: PropertyDescriptor
) {
  const method = descriptor.value

  descriptor.value = async function (...args: any[]) {
    const startTime = performance.now()
    const startMemory = memoryOptimizer.getMemoryStats()

    try {
      const result = await method.apply(this, args)
      const endTime = performance.now()
      const endMemory = memoryOptimizer.getMemoryStats()

      logger.debug('Method performance', {
        method: propertyName,
        duration: `${(endTime - startTime).toFixed(2)}ms`,
        memoryDelta: `${((endMemory.used - startMemory.used) / 1024).toFixed(2)}KB`
      })

      return result
    } catch (error) {
      const endTime = performance.now()
      
      logger.error('Method failed', error, {
        method: propertyName,
        duration: `${(endTime - startTime).toFixed(2)}ms`
      })
      
      throw error
    }
  }

  return descriptor
}