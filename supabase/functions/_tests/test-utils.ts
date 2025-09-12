// Test utilities for Supabase Edge Functions
import { assertEquals, assertExists, assertThrows } from "https://deno.land/std@0.168.0/testing/asserts.ts"

export interface TestRequest {
  method?: string
  url?: string
  headers?: Record<string, string>
  body?: any
}

export interface TestResponse {
  status: number
  headers: Headers
  body: any
}

// Mock Supabase client for testing
export class MockSupabaseClient {
  private mockData: Map<string, any[]> = new Map()
  private mockErrors: Map<string, any> = new Map()

  constructor() {
    this.setupDefaultMockData()
  }

  private setupDefaultMockData() {
    // Mock users table
    this.mockData.set('users', [
      {
        id: 'user-1',
        email: 'test@example.com',
        password_hash: '$2b$10$hashedpassword',
        role: 'user',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z'
      }
    ])

    // Mock projects table
    this.mockData.set('projects', [
      {
        id: 1,
        user_id: 'user-1',
        name: 'Test Project',
        status: 'planning',
        created_at: '2024-01-01T00:00:00Z'
      }
    ])

    // Mock conversations table
    this.mockData.set('conversations', [
      {
        id: 'conv-1',
        tavus_conversation_id: 'tavus-123',
        status: 'completed',
        transcript: 'Test conversation transcript',
        created_at: '2024-01-01T00:00:00Z'
      }
    ])
  }

  from(table: string) {
    return new MockQueryBuilder(this.mockData, this.mockErrors, table)
  }

  setMockData(table: string, data: any[]) {
    this.mockData.set(table, data)
  }

  setMockError(table: string, error: any) {
    this.mockErrors.set(table, error)
  }

  clearMockData() {
    this.mockData.clear()
    this.mockErrors.clear()
    this.setupDefaultMockData()
  }
}

class MockQueryBuilder {
  private filters: Array<{ column: string; operator: string; value: any }> = []
  private selectColumns = '*'
  private limitValue?: number
  private orderColumn?: string
  private orderAscending = true

  constructor(
    private mockData: Map<string, any[]>,
    private mockErrors: Map<string, any>,
    private table: string
  ) {}

  select(columns = '*') {
    this.selectColumns = columns
    return this
  }

  eq(column: string, value: any) {
    this.filters.push({ column, operator: 'eq', value })
    return this
  }

  neq(column: string, value: any) {
    this.filters.push({ column, operator: 'neq', value })
    return this
  }

  gte(column: string, value: any) {
    this.filters.push({ column, operator: 'gte', value })
    return this
  }

  lte(column: string, value: any) {
    this.filters.push({ column, operator: 'lte', value })
    return this
  }

  in(column: string, values: any[]) {
    this.filters.push({ column, operator: 'in', value: values })
    return this
  }

  limit(count: number) {
    this.limitValue = count
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column
    this.orderAscending = options?.ascending ?? true
    return this
  }

  range(from: number, to: number) {
    this.limitValue = to - from + 1
    return this
  }

  async single() {
    const result = await this.execute()
    if (result.error) return result
    
    if (!result.data || result.data.length === 0) {
      return { data: null, error: { message: 'No rows found' } }
    }
    
    if (result.data.length > 1) {
      return { data: null, error: { message: 'Multiple rows found' } }
    }
    
    return { data: result.data[0], error: null }
  }

  async execute() {
    // Check for mock error
    const error = this.mockErrors.get(this.table)
    if (error) {
      return { data: null, error }
    }

    let data = this.mockData.get(this.table) || []

    // Apply filters
    for (const filter of this.filters) {
      data = data.filter(row => {
        const value = row[filter.column]
        switch (filter.operator) {
          case 'eq':
            return value === filter.value
          case 'neq':
            return value !== filter.value
          case 'gte':
            return value >= filter.value
          case 'lte':
            return value <= filter.value
          case 'in':
            return filter.value.includes(value)
          default:
            return true
        }
      })
    }

    // Apply ordering
    if (this.orderColumn) {
      data.sort((a, b) => {
        const aVal = a[this.orderColumn!]
        const bVal = b[this.orderColumn!]
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        return this.orderAscending ? comparison : -comparison
      })
    }

    // Apply limit
    if (this.limitValue) {
      data = data.slice(0, this.limitValue)
    }

    return { data, error: null }
  }

  // For insert operations
  async insert(values: any | any[]) {
    const error = this.mockErrors.get(this.table)
    if (error) {
      return { data: null, error }
    }

    const insertData = Array.isArray(values) ? values : [values]
    const existingData = this.mockData.get(this.table) || []
    
    // Add IDs if not present
    const newData = insertData.map(item => ({
      ...item,
      id: item.id || `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }))

    this.mockData.set(this.table, [...existingData, ...newData])
    
    return { data: newData, error: null }
  }

  // For update operations
  async update(values: any) {
    const error = this.mockErrors.get(this.table)
    if (error) {
      return { data: null, error }
    }

    let data = this.mockData.get(this.table) || []
    
    // Apply filters to find rows to update
    const updatedData = data.map(row => {
      let shouldUpdate = true
      for (const filter of this.filters) {
        const value = row[filter.column]
        switch (filter.operator) {
          case 'eq':
            shouldUpdate = shouldUpdate && value === filter.value
            break
          case 'neq':
            shouldUpdate = shouldUpdate && value !== filter.value
            break
          default:
            break
        }
      }
      
      return shouldUpdate ? { ...row, ...values } : row
    })

    this.mockData.set(this.table, updatedData)
    
    return { data: updatedData.filter(row => {
      let matches = true
      for (const filter of this.filters) {
        const value = row[filter.column]
        if (filter.operator === 'eq' && value !== filter.value) {
          matches = false
          break
        }
      }
      return matches
    }), error: null }
  }

  // For delete operations
  async delete() {
    const error = this.mockErrors.get(this.table)
    if (error) {
      return { data: null, error }
    }

    let data = this.mockData.get(this.table) || []
    
    const deletedRows = data.filter(row => {
      let shouldDelete = true
      for (const filter of this.filters) {
        const value = row[filter.column]
        if (filter.operator === 'eq' && value !== filter.value) {
          shouldDelete = false
          break
        }
      }
      return shouldDelete
    })

    const remainingData = data.filter(row => {
      let shouldDelete = true
      for (const filter of this.filters) {
        const value = row[filter.column]
        if (filter.operator === 'eq' && value !== filter.value) {
          shouldDelete = false
          break
        }
      }
      return !shouldDelete
    })

    this.mockData.set(this.table, remainingData)
    
    return { data: deletedRows, error: null }
  }

  // Alias for execute to match Supabase API
  then(callback: (result: any) => any) {
    return this.execute().then(callback)
  }
}

// Mock fetch for external API calls
export class MockFetch {
  private responses: Map<string, any> = new Map()
  private callLog: Array<{ url: string; options: any }> = []

  setMockResponse(url: string, response: any) {
    this.responses.set(url, response)
  }

  setMockResponsePattern(pattern: RegExp, response: any) {
    this.responses.set(pattern.toString(), response)
  }

  getCallLog() {
    return [...this.callLog]
  }

  clearCallLog() {
    this.callLog = []
  }

  async fetch(url: string, options?: any): Promise<Response> {
    this.callLog.push({ url, options })

    // Check for exact URL match
    if (this.responses.has(url)) {
      const mockResponse = this.responses.get(url)
      return new Response(JSON.stringify(mockResponse.body), {
        status: mockResponse.status || 200,
        headers: mockResponse.headers || {}
      })
    }

    // Check for pattern matches
    for (const [key, response] of this.responses.entries()) {
      if (key.startsWith('/') && key.endsWith('/')) {
        const pattern = new RegExp(key.slice(1, -1))
        if (pattern.test(url)) {
          return new Response(JSON.stringify(response.body), {
            status: response.status || 200,
            headers: response.headers || {}
          })
        }
      }
    }

    // Default response
    return new Response(JSON.stringify({ error: 'Not mocked' }), {
      status: 404
    })
  }
}

// Test helper functions
export function createTestRequest(options: TestRequest = {}): Request {
  const {
    method = 'GET',
    url = 'http://localhost:8000/test',
    headers = {},
    body
  } = options

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }

  if (body && method !== 'GET') {
    requestInit.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  return new Request(url, requestInit)
}

export async function parseTestResponse(response: Response): Promise<TestResponse> {
  const body = await response.text()
  let parsedBody
  
  try {
    parsedBody = JSON.parse(body)
  } catch {
    parsedBody = body
  }

  return {
    status: response.status,
    headers: response.headers,
    body: parsedBody
  }
}

// Environment setup for tests
export function setupTestEnvironment() {
  // Set test environment variables
  Deno.env.set('SUPABASE_URL', 'http://localhost:54321')
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  Deno.env.set('OPENAI_API_KEY', 'test-openai-key')
  Deno.env.set('TAVUS_API_KEY', 'test-tavus-key')
  Deno.env.set('KIRO_API_KEY', 'test-kiro-key')
  Deno.env.set('ADMIN_TOKEN', 'test-admin-token')
}

// Test assertions
export function assertResponseOk(response: TestResponse, message?: string) {
  assertEquals(response.status >= 200 && response.status < 300, true, 
    message || `Expected successful response, got ${response.status}`)
}

export function assertResponseError(response: TestResponse, expectedStatus?: number, message?: string) {
  if (expectedStatus) {
    assertEquals(response.status, expectedStatus, 
      message || `Expected status ${expectedStatus}, got ${response.status}`)
  } else {
    assertEquals(response.status >= 400, true, 
      message || `Expected error response, got ${response.status}`)
  }
}

export function assertResponseBody(response: TestResponse, expectedBody: any, message?: string) {
  assertEquals(response.body, expectedBody, message || 'Response body mismatch')
}

export function assertResponseBodyContains(response: TestResponse, key: string, message?: string) {
  assertExists(response.body[key], message || `Expected response body to contain key: ${key}`)
}

// Performance testing utilities
export class PerformanceTimer {
  private startTime: number = 0
  private endTime: number = 0

  start() {
    this.startTime = performance.now()
  }

  stop() {
    this.endTime = performance.now()
  }

  getDuration(): number {
    return this.endTime - this.startTime
  }

  assertDurationLessThan(maxMs: number, message?: string) {
    const duration = this.getDuration()
    assertEquals(duration < maxMs, true, 
      message || `Expected duration < ${maxMs}ms, got ${duration}ms`)
  }
}

// Load testing utilities
export async function runLoadTest(
  testFunction: () => Promise<any>,
  options: {
    concurrent: number
    duration: number
    rampUp?: number
  }
): Promise<{
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  maxResponseTime: number
  minResponseTime: number
}> {
  const { concurrent, duration, rampUp = 0 } = options
  const results: Array<{ success: boolean; duration: number }> = []
  const startTime = Date.now()
  const endTime = startTime + duration

  // Ramp up gradually if specified
  const rampUpInterval = rampUp > 0 ? rampUp / concurrent : 0
  
  const workers: Promise<void>[] = []
  
  for (let i = 0; i < concurrent; i++) {
    const delay = rampUpInterval * i
    
    workers.push((async () => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      
      while (Date.now() < endTime) {
        const requestStart = performance.now()
        try {
          await testFunction()
          const requestEnd = performance.now()
          results.push({ success: true, duration: requestEnd - requestStart })
        } catch (error) {
          const requestEnd = performance.now()
          results.push({ success: false, duration: requestEnd - requestStart })
        }
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    })())
  }

  await Promise.all(workers)

  const successfulRequests = results.filter(r => r.success).length
  const failedRequests = results.filter(r => !r.success).length
  const durations = results.map(r => r.duration)
  
  return {
    totalRequests: results.length,
    successfulRequests,
    failedRequests,
    averageResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
    maxResponseTime: Math.max(...durations),
    minResponseTime: Math.min(...durations)
  }
}