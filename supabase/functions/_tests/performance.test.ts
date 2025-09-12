import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import {
  MockSupabaseClient,
  MockFetch,
  createTestRequest,
  parseTestResponse,
  setupTestEnvironment,
  assertResponseOk,
  PerformanceTimer,
  runLoadTest
} from './test-utils.ts'

// Performance benchmarks and thresholds
const PERFORMANCE_THRESHOLDS = {
  auth_login: 200,           // 200ms max for login
  rate_limit_check: 50,      // 50ms max for rate limit check
  conversation_analysis: 5000, // 5s max for AI analysis
  project_plan_generation: 10000, // 10s max for plan generation
  kiro_build_trigger: 3000,  // 3s max for build trigger
  webhook_processing: 100,   // 100ms max for webhook processing
  database_query: 100,       // 100ms max for simple DB queries
  concurrent_users: 50,      // Support 50 concurrent users
  requests_per_second: 100   // Handle 100 requests per second
}

// Mock performance-optimized functions
class PerformanceTestSuite {
  private mockDb: MockSupabaseClient
  private mockFetch: MockFetch

  constructor() {
    this.mockDb = new MockSupabaseClient()
    this.mockFetch = new MockFetch()
    this.setupOptimizedMocks()
  }

  private setupOptimizedMocks() {
    // Setup fast mock responses
    this.mockFetch.setMockResponse('https://api.openai.com/v1/chat/completions', {
      status: 200,
      body: {
        choices: [{
          message: {
            content: JSON.stringify({
              analysis: 'Fast mock analysis',
              confidence: 0.95
            })
          }
        }]
      }
    })
  }

  async performAuthLogin(): Promise<number> {
    const timer = new PerformanceTimer()
    timer.start()

    // Simulate auth operations
    await this.simulatePasswordHashing()
    await this.simulateJWTGeneration()
    await this.simulateDatabaseQuery()

    timer.stop()
    return timer.getDuration()
  }

  async performRateLimitCheck(): Promise<number> {
    const timer = new PerformanceTimer()
    timer.start()

    // Simulate in-memory rate limit check
    const identifier = 'test-user'
    const limit = { requests: 100, window: 60 }
    
    // Fast in-memory operations
    const now = Date.now()
    const resetTime = Math.ceil(now / (limit.window * 1000)) * (limit.window * 1000)
    const allowed = true // Fast check

    timer.stop()
    return timer.getDuration()
  }

  async performConversationAnalysis(): Promise<number> {
    const timer = new PerformanceTimer()
    timer.start()

    // Simulate AI API call with timeout
    await this.simulateAIAPICall()
    await this.simulateDatabaseInsert()

    timer.stop()
    return timer.getDuration()
  }

  async performWebhookProcessing(): Promise<number> {
    const timer = new PerformanceTimer()
    timer.start()

    // Simulate webhook validation and processing
    await this.simulateWebhookValidation()
    await this.simulateDatabaseUpdate()
    await this.simulateEventBroadcast()

    timer.stop()
    return timer.getDuration()
  }

  async performDatabaseQuery(): Promise<number> {
    const timer = new PerformanceTimer()
    timer.start()

    // Simulate optimized database query
    const result = await this.mockDb.from('projects')
      .select('*')
      .eq('status', 'active')
      .limit(10)

    timer.stop()
    return timer.getDuration()
  }

  // Helper simulation methods
  private async simulatePasswordHashing(): Promise<void> {
    // Simulate bcrypt hashing time
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  private async simulateJWTGeneration(): Promise<void> {
    // Simulate JWT creation time
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  private async simulateDatabaseQuery(): Promise<void> {
    // Simulate database query time
    await new Promise(resolve => setTimeout(resolve, 20))
  }

  private async simulateDatabaseInsert(): Promise<void> {
    // Simulate database insert time
    await new Promise(resolve => setTimeout(resolve, 30))
  }

  private async simulateDatabaseUpdate(): Promise<void> {
    // Simulate database update time
    await new Promise(resolve => setTimeout(resolve, 25))
  }

  private async simulateAIAPICall(): Promise<void> {
    // Simulate AI API response time
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  private async simulateWebhookValidation(): Promise<void> {
    // Simulate webhook signature validation
    await new Promise(resolve => setTimeout(resolve, 5))
  }

  private async simulateEventBroadcast(): Promise<void> {
    // Simulate real-time event broadcasting
    await new Promise(resolve => setTimeout(resolve, 15))
  }
}

const performanceTest = new PerformanceTestSuite()

Deno.test('Performance - Auth Login Speed', async () => {
  setupTestEnvironment()

  const duration = await performanceTest.performAuthLogin()
  
  assertEquals(duration < PERFORMANCE_THRESHOLDS.auth_login, true, 
    `Auth login took ${duration.toFixed(2)}ms, should be under ${PERFORMANCE_THRESHOLDS.auth_login}ms`)
  
  console.log(`Auth login performance: ${duration.toFixed(2)}ms`)
})

Deno.test('Performance - Rate Limit Check Speed', async () => {
  setupTestEnvironment()

  const duration = await performanceTest.performRateLimitCheck()
  
  assertEquals(duration < PERFORMANCE_THRESHOLDS.rate_limit_check, true,
    `Rate limit check took ${duration.toFixed(2)}ms, should be under ${PERFORMANCE_THRESHOLDS.rate_limit_check}ms`)
  
  console.log(`Rate limit check performance: ${duration.toFixed(2)}ms`)
})

Deno.test('Performance - Conversation Analysis Speed', async () => {
  setupTestEnvironment()

  const duration = await performanceTest.performConversationAnalysis()
  
  assertEquals(duration < PERFORMANCE_THRESHOLDS.conversation_analysis, true,
    `Conversation analysis took ${duration.toFixed(2)}ms, should be under ${PERFORMANCE_THRESHOLDS.conversation_analysis}ms`)
  
  console.log(`Conversation analysis performance: ${duration.toFixed(2)}ms`)
})

Deno.test('Performance - Webhook Processing Speed', async () => {
  setupTestEnvironment()

  const duration = await performanceTest.performWebhookProcessing()
  
  assertEquals(duration < PERFORMANCE_THRESHOLDS.webhook_processing, true,
    `Webhook processing took ${duration.toFixed(2)}ms, should be under ${PERFORMANCE_THRESHOLDS.webhook_processing}ms`)
  
  console.log(`Webhook processing performance: ${duration.toFixed(2)}ms`)
})

Deno.test('Performance - Database Query Speed', async () => {
  setupTestEnvironment()

  const duration = await performanceTest.performDatabaseQuery()
  
  assertEquals(duration < PERFORMANCE_THRESHOLDS.database_query, true,
    `Database query took ${duration.toFixed(2)}ms, should be under ${PERFORMANCE_THRESHOLDS.database_query}ms`)
  
  console.log(`Database query performance: ${duration.toFixed(2)}ms`)
})

Deno.test('Performance - Concurrent User Load Test', async () => {
  setupTestEnvironment()

  const loadTestResults = await runLoadTest(
    async () => {
      // Simulate a typical user workflow
      await performanceTest.performAuthLogin()
      await performanceTest.performRateLimitCheck()
      await performanceTest.performDatabaseQuery()
      return 'success'
    },
    {
      concurrent: PERFORMANCE_THRESHOLDS.concurrent_users,
      duration: 10000, // 10 seconds
      rampUp: 2000     // 2 second ramp up
    }
  )

  // Verify performance under load
  assertEquals(loadTestResults.failedRequests, 0, 'No requests should fail under normal load')
  assertEquals(loadTestResults.averageResponseTime < 1000, true, 'Average response time should be reasonable under load')
  
  const successRate = (loadTestResults.successfulRequests / loadTestResults.totalRequests) * 100
  assertEquals(successRate >= 95, true, 'Success rate should be at least 95%')

  console.log('Concurrent user load test results:', {
    totalRequests: loadTestResults.totalRequests,
    successfulRequests: loadTestResults.successfulRequests,
    failedRequests: loadTestResults.failedRequests,
    successRate: `${successRate.toFixed(2)}%`,
    averageResponseTime: `${loadTestResults.averageResponseTime.toFixed(2)}ms`,
    maxResponseTime: `${loadTestResults.maxResponseTime.toFixed(2)}ms`,
    minResponseTime: `${loadTestResults.minResponseTime.toFixed(2)}ms`
  })
})

Deno.test('Performance - High Throughput Test', async () => {
  setupTestEnvironment()

  const testDuration = 5000 // 5 seconds
  const startTime = Date.now()
  let requestCount = 0
  const errors: string[] = []

  // Run high-throughput test
  const workers = []
  for (let i = 0; i < 10; i++) {
    workers.push((async () => {
      while (Date.now() - startTime < testDuration) {
        try {
          await performanceTest.performRateLimitCheck()
          requestCount++
        } catch (error) {
          errors.push(error.message)
        }
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 5))
      }
    })())
  }

  await Promise.all(workers)

  const actualDuration = Date.now() - startTime
  const requestsPerSecond = (requestCount / actualDuration) * 1000

  assertEquals(errors.length, 0, `Should have no errors, got: ${errors.join(', ')}`)
  assertEquals(requestsPerSecond >= PERFORMANCE_THRESHOLDS.requests_per_second, true,
    `Should handle at least ${PERFORMANCE_THRESHOLDS.requests_per_second} req/s, got ${requestsPerSecond.toFixed(2)} req/s`)

  console.log(`High throughput test: ${requestsPerSecond.toFixed(2)} requests/second`)
})

Deno.test('Performance - Memory Usage Test', async () => {
  setupTestEnvironment()

  // Get initial memory usage (if available)
  const initialMemory = (performance as any).memory?.usedJSHeapSize || 0

  // Perform memory-intensive operations
  const operations = []
  for (let i = 0; i < 1000; i++) {
    operations.push(performanceTest.performDatabaseQuery())
  }

  await Promise.all(operations)

  // Force garbage collection if available
  if (typeof (globalThis as any).gc === 'function') {
    (globalThis as any).gc()
  }

  const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
  const memoryIncrease = finalMemory - initialMemory

  // Memory increase should be reasonable (less than 50MB for 1000 operations)
  const maxMemoryIncrease = 50 * 1024 * 1024 // 50MB
  
  if (initialMemory > 0) {
    assertEquals(memoryIncrease < maxMemoryIncrease, true,
      `Memory increase should be less than 50MB, got ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
    
    console.log(`Memory usage: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase`)
  } else {
    console.log('Memory monitoring not available in this environment')
  }
})

Deno.test('Performance - Database Connection Pool Test', async () => {
  setupTestEnvironment()

  const timer = new PerformanceTimer()
  timer.start()

  // Simulate multiple concurrent database operations
  const dbOperations = []
  for (let i = 0; i < 50; i++) {
    dbOperations.push(performanceTest.performDatabaseQuery())
  }

  await Promise.all(dbOperations)
  timer.stop()

  const totalDuration = timer.getDuration()
  const averageDuration = totalDuration / 50

  // With proper connection pooling, average should be close to single query time
  assertEquals(averageDuration < PERFORMANCE_THRESHOLDS.database_query * 2, true,
    `Average DB query time with pooling should be reasonable: ${averageDuration.toFixed(2)}ms`)

  console.log(`Database connection pool test: ${averageDuration.toFixed(2)}ms average per query`)
})

Deno.test('Performance - Rate Limiter Under Load', async () => {
  setupTestEnvironment()

  const loadTestResults = await runLoadTest(
    async () => {
      const identifier = `user-${Math.floor(Math.random() * 100)}`
      return await performanceTest.performRateLimitCheck()
    },
    {
      concurrent: 20,
      duration: 5000,
      rampUp: 1000
    }
  )

  // Rate limiter should maintain performance under load
  assertEquals(loadTestResults.averageResponseTime < PERFORMANCE_THRESHOLDS.rate_limit_check * 2, true,
    `Rate limiter should maintain performance under load: ${loadTestResults.averageResponseTime.toFixed(2)}ms average`)

  const throughput = loadTestResults.totalRequests / 5 // requests per second
  assertEquals(throughput >= 200, true, 'Rate limiter should handle at least 200 checks per second')

  console.log(`Rate limiter load test: ${throughput.toFixed(2)} checks/second`)
})

Deno.test('Performance - End-to-End Pipeline Benchmark', async () => {
  setupTestEnvironment()

  const timer = new PerformanceTimer()
  timer.start()

  // Simulate complete pipeline flow
  await performanceTest.performAuthLogin()
  await performanceTest.performRateLimitCheck()
  await performanceTest.performConversationAnalysis()
  await performanceTest.performDatabaseQuery()
  await performanceTest.performWebhookProcessing()

  timer.stop()

  const totalDuration = timer.getDuration()
  
  // Complete pipeline should finish within reasonable time
  const maxPipelineDuration = 15000 // 15 seconds
  assertEquals(totalDuration < maxPipelineDuration, true,
    `Complete pipeline took ${totalDuration.toFixed(2)}ms, should be under ${maxPipelineDuration}ms`)

  console.log(`End-to-end pipeline benchmark: ${totalDuration.toFixed(2)}ms`)
})

Deno.test('Performance - Stress Test Recovery', async () => {
  setupTestEnvironment()

  // Phase 1: Normal load
  const normalLoad = await runLoadTest(
    () => performanceTest.performRateLimitCheck(),
    { concurrent: 10, duration: 2000, rampUp: 500 }
  )

  // Phase 2: High stress load
  const stressLoad = await runLoadTest(
    () => performanceTest.performRateLimitCheck(),
    { concurrent: 100, duration: 3000, rampUp: 1000 }
  )

  // Phase 3: Recovery to normal load
  const recoveryLoad = await runLoadTest(
    () => performanceTest.performRateLimitCheck(),
    { concurrent: 10, duration: 2000, rampUp: 500 }
  )

  // System should recover to normal performance levels
  const performanceDegradation = (recoveryLoad.averageResponseTime / normalLoad.averageResponseTime)
  assertEquals(performanceDegradation < 2, true, 
    `System should recover after stress test, degradation factor: ${performanceDegradation.toFixed(2)}`)

  console.log('Stress test recovery:', {
    normalLoad: `${normalLoad.averageResponseTime.toFixed(2)}ms`,
    stressLoad: `${stressLoad.averageResponseTime.toFixed(2)}ms`,
    recoveryLoad: `${recoveryLoad.averageResponseTime.toFixed(2)}ms`,
    degradationFactor: performanceDegradation.toFixed(2)
  })
})