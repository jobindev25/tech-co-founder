import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import {
  MockSupabaseClient,
  createTestRequest,
  parseTestResponse,
  setupTestEnvironment,
  assertResponseOk,
  assertResponseError,
  assertResponseBodyContains,
  PerformanceTimer
} from './test-utils.ts'

// Mock rate limiter implementation
class MockRateLimiter {
  private limits: Map<string, { count: number; resetTime: number; blocked: boolean }> = new Map()
  
  checkRateLimit(identifier: string, rule: { requests: number; window: number }): {
    allowed: boolean
    currentCount: number
    resetTime: number
  } {
    const now = Date.now()
    const windowStart = now - (rule.window * 1000)
    const resetTime = Math.ceil(now / (rule.window * 1000)) * (rule.window * 1000)
    
    let entry = this.limits.get(identifier)
    
    if (!entry || entry.resetTime <= now) {
      entry = { count: 0, resetTime, blocked: false }
    }
    
    entry.count++
    const allowed = entry.count <= rule.requests && !entry.blocked
    
    if (!allowed) {
      entry.blocked = true
    }
    
    this.limits.set(identifier, entry)
    
    return {
      allowed,
      currentCount: entry.count,
      resetTime: entry.resetTime
    }
  }
  
  reset(identifier?: string) {
    if (identifier) {
      this.limits.delete(identifier)
    } else {
      this.limits.clear()
    }
  }
  
  block(identifier: string) {
    const entry = this.limits.get(identifier) || { count: 0, resetTime: Date.now() + 60000, blocked: false }
    entry.blocked = true
    this.limits.set(identifier, entry)
  }
}

const mockRateLimiter = new MockRateLimiter()

async function mockRateLimiterFunction(req: Request): Promise<Response> {
  const body = await req.json()
  const { identifier, rule_name, increment = true } = body
  
  if (!identifier || !rule_name) {
    return new Response(JSON.stringify({ error: 'Identifier and rule_name required' }), { status: 400 })
  }
  
  const rules: Record<string, { requests: number; window: number }> = {
    'api_general': { requests: 100, window: 60 },
    'api_auth': { requests: 10, window: 60 },
    'api_conversation': { requests: 5, window: 60 }
  }
  
  const rule = rules[rule_name]
  if (!rule) {
    return new Response(JSON.stringify({ error: 'Invalid rule name' }), { status: 400 })
  }
  
  if (increment) {
    const result = mockRateLimiter.checkRateLimit(identifier, rule)
    
    const response = {
      allowed: result.allowed,
      rule: rule_name,
      limit: rule.requests,
      remaining: Math.max(0, rule.requests - result.currentCount),
      reset_time: result.resetTime,
      retry_after: result.allowed ? null : rule.window
    }
    
    const statusCode = result.allowed ? 200 : 429
    return new Response(JSON.stringify(response), { status: statusCode })
  }
  
  return new Response(JSON.stringify({ allowed: true }), { status: 200 })
}

Deno.test('Rate Limiter - Allow Within Limit', async () => {
  setupTestEnvironment()
  mockRateLimiter.reset()
  
  const request = createTestRequest({
    method: 'POST',
    url: 'http://localhost:8000/rate-limiter',
    body: {
      identifier: 'user-1',
      rule_name: 'api_general',
      increment: true
    }
  })
  
  const response = await mockRateLimiterFunction(request)
  const parsedResponse = await parseTestResponse(response)
  
  assertResponseOk(parsedResponse)
  assertEquals(parsedResponse.body.allowed, true)
  assertEquals(parsedResponse.body.limit, 100)
  assertEquals(parsedResponse.body.remaining, 99)
})

Deno.test('Rate Limiter - Block When Limit Exceeded', async () => {
  setupTestEnvironment()
  mockRateLimiter.reset()
  
  // Make requests up to the limit
  for (let i = 0; i < 5; i++) {
    const request = createTestRequest({
      method: 'POST',
      url: 'http://localhost:8000/rate-limiter',
      body: {
        identifier: 'user-2',
        rule_name: 'api_conversation',
        increment: true
      }
    })
    
    await mockRateLimiterFunction(request)
  }
  
  // This request should be blocked
  const request = createTestRequest({
    method: 'POST',
    url: 'http://localhost:8000/rate-limiter',
    body: {
      identifier: 'user-2',
      rule_name: 'api_conversation',
      increment: true
    }
  })
  
  const response = await mockRateLimiterFunction(request)
  const parsedResponse = await parseTestResponse(response)
  
  assertResponseError(parsedResponse, 429)
  assertEquals(parsedResponse.body.allowed, false)
  assertEquals(parsedResponse.body.remaining, 0)
  assertExists(parsedResponse.body.retry_after)
})

Deno.test('Rate Limiter - Different Rules Have Different Limits', async () => {
  setupTestEnvironment()
  mockRateLimiter.reset()
  
  // Test auth rule (limit: 10)
  const authRequest = createTestRequest({
    method: 'POST',
    url: 'http://localhost:8000/rate-limiter',
    body: {
      identifier: 'user-3',
      rule_name: 'api_auth',
      increment: true
    }
  })
  
  const authResponse = await mockRateLimiterFunction(authRequest)
  const authParsed = await parseTestResponse(authResponse)
  
  assertResponseOk(authParsed)
  assertEquals(authParsed.body.limit, 10)
  
  // Test general rule (limit: 100)
  const generalRequest = createTestRequest({
    method: 'POST',
    url: 'http://localhost:8000/rate-limiter',
    body: {
      identifier: 'user-3',
      rule_name: 'api_general',
      increment: true
    }
  })
  
  const generalResponse = await mockRateLimiterFunction(generalRequest)
  const generalParsed = await parseTestResponse(generalResponse)
  
  assertResponseOk(generalParsed)
  assertEquals(generalParsed.body.limit, 100)
})

Deno.test('Rate Limiter - Missing Parameters', async () => {
  setupTestEnvironment()
  
  const request = createTestRequest({
    method: 'POST',
    url: 'http://localhost:8000/rate-limiter',
    body: {
      identifier: 'user-4'
      // Missing rule_name
    }
  })
  
  const response = await mockRateLimiterFunction(request)
  const parsedResponse = await parseTestResponse(response)
  
  assertResponseError(parsedResponse, 400)
  assertEquals(parsedResponse.body.error, 'Identifier and rule_name required')
})

Deno.test('Rate Limiter - Invalid Rule Name', async () => {
  setupTestEnvironment()
  
  const request = createTestRequest({
    method: 'POST',
    url: 'http://localhost:8000/rate-limiter',
    body: {
      identifier: 'user-5',
      rule_name: 'invalid_rule'
    }
  })
  
  const response = await mockRateLimiterFunction(request)
  const parsedResponse = await parseTestResponse(response)
  
  assertResponseError(parsedResponse, 400)
  assertEquals(parsedResponse.body.error, 'Invalid rule name')
})

Deno.test('Rate Limiter - Performance Test', async () => {
  setupTestEnvironment()
  mockRateLimiter.reset()
  
  const timer = new PerformanceTimer()
  timer.start()
  
  // Make 100 rapid requests
  const promises = []
  for (let i = 0; i < 100; i++) {
    const request = createTestRequest({
      method: 'POST',
      url: 'http://localhost:8000/rate-limiter',
      body: {
        identifier: `perf-user-${i}`,
        rule_name: 'api_general',
        increment: true
      }
    })
    
    promises.push(mockRateLimiterFunction(request))
  }
  
  await Promise.all(promises)
  timer.stop()
  
  // Should complete within reasonable time (less than 1 second for 100 requests)
  timer.assertDurationLessThan(1000, 'Rate limiter should handle 100 requests quickly')
})

Deno.test('Rate Limiter - Concurrent Requests Same User', async () => {
  setupTestEnvironment()
  mockRateLimiter.reset()
  
  // Make 10 concurrent requests for the same user with auth rule (limit: 10)
  const promises = []
  for (let i = 0; i < 10; i++) {
    const request = createTestRequest({
      method: 'POST',
      url: 'http://localhost:8000/rate-limiter',
      body: {
        identifier: 'concurrent-user',
        rule_name: 'api_auth',
        increment: true
      }
    })
    
    promises.push(mockRateLimiterFunction(request))
  }
  
  const responses = await Promise.all(promises)
  const parsedResponses = await Promise.all(
    responses.map(r => parseTestResponse(r))
  )
  
  // All should be allowed since we're at the limit
  const allowedCount = parsedResponses.filter(r => r.body.allowed).length
  const blockedCount = parsedResponses.filter(r => !r.body.allowed).length
  
  // Due to concurrent execution, some might be blocked
  assertEquals(allowedCount + blockedCount, 10)
  assertEquals(allowedCount <= 10, true, 'Should not allow more than the limit')
})

Deno.test('Rate Limiter - Reset Functionality', async () => {
  setupTestEnvironment()
  mockRateLimiter.reset()
  
  // Exhaust the limit
  for (let i = 0; i < 5; i++) {
    const request = createTestRequest({
      method: 'POST',
      url: 'http://localhost:8000/rate-limiter',
      body: {
        identifier: 'reset-user',
        rule_name: 'api_conversation',
        increment: true
      }
    })
    
    await mockRateLimiterFunction(request)
  }
  
  // Next request should be blocked
  let request = createTestRequest({
    method: 'POST',
    url: 'http://localhost:8000/rate-limiter',
    body: {
      identifier: 'reset-user',
      rule_name: 'api_conversation',
      increment: true
    }
  })
  
  let response = await mockRateLimiterFunction(request)
  let parsedResponse = await parseTestResponse(response)
  
  assertResponseError(parsedResponse, 429)
  
  // Reset the rate limiter
  mockRateLimiter.reset('reset-user')
  
  // Now the request should be allowed
  request = createTestRequest({
    method: 'POST',
    url: 'http://localhost:8000/rate-limiter',
    body: {
      identifier: 'reset-user',
      rule_name: 'api_conversation',
      increment: true
    }
  })
  
  response = await mockRateLimiterFunction(request)
  parsedResponse = await parseTestResponse(response)
  
  assertResponseOk(parsedResponse)
  assertEquals(parsedResponse.body.allowed, true)
})