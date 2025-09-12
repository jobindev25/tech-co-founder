import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import {
  MockSupabaseClient,
  MockFetch,
  createTestRequest,
  parseTestResponse,
  setupTestEnvironment,
  assertResponseOk,
  assertResponseError,
  assertResponseBodyContains,
  PerformanceTimer,
  runLoadTest
} from './test-utils.ts'

// Mock implementations for integration testing
class MockPipelineSystem {
  private mockDb: MockSupabaseClient
  private mockFetch: MockFetch
  private conversations: Map<string, any> = new Map()
  private projects: Map<string, any> = new Map()
  private buildEvents: Map<string, any[]> = new Map()

  constructor() {
    this.mockDb = new MockSupabaseClient()
    this.mockFetch = new MockFetch()
    this.setupMockResponses()
  }

  private setupMockResponses() {
    // Mock Tavus API responses
    this.mockFetch.setMockResponse('https://tavusapi.com/v2/conversations/conv-123', {
      status: 200,
      body: {
        conversation_id: 'conv-123',
        status: 'ended',
        transcript: 'I want to build a todo app with React and Node.js'
      }
    })

    // Mock OpenAI API responses
    this.mockFetch.setMockResponsePattern(/openai\.com/, {
      status: 200,
      body: {
        choices: [{
          message: {
            content: JSON.stringify({
              project_type: 'web_application',
              tech_stack: {
                frontend: 'React',
                backend: 'Node.js',
                database: 'PostgreSQL'
              },
              features: [
                { name: 'Task Management', priority: 'high' },
                { name: 'User Authentication', priority: 'medium' }
              ]
            })
          }
        }]
      }
    })

    // Mock Kiro API responses
    this.mockFetch.setMockResponsePattern(/kiro\.dev/, {
      status: 200,
      body: {
        build_id: 'build-123',
        project_id: 'kiro-proj-123',
        status: 'initiated',
        estimated_completion: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    })
  }

  // Mock conversation analysis
  async analyzeConversation(conversationId: string): Promise<any> {
    const conversation = {
      id: conversationId,
      tavus_conversation_id: conversationId,
      status: 'completed',
      transcript: 'I want to build a todo app with React and Node.js',
      analysis: {
        project_type: 'web_application',
        confidence: 0.95,
        key_requirements: ['task management', 'user interface', 'data persistence']
      },
      created_at: new Date().toISOString()
    }

    this.conversations.set(conversationId, conversation)
    return conversation
  }

  // Mock project plan generation
  async generateProjectPlan(conversationId: string): Promise<any> {
    const conversation = this.conversations.get(conversationId)
    if (!conversation) {
      throw new Error('Conversation not found')
    }

    const project = {
      id: `proj-${Date.now()}`,
      conversation_id: conversationId,
      name: 'Todo Application',
      description: 'A web-based todo application with React frontend and Node.js backend',
      status: 'planning',
      project_plan: {
        name: 'Todo Application',
        description: 'A web-based todo application',
        techStack: {
          frontend: 'React',
          backend: 'Node.js',
          database: 'PostgreSQL'
        },
        features: [
          { name: 'Task Management', description: 'Create, edit, delete tasks', priority: 'high' },
          { name: 'User Authentication', description: 'Login and registration', priority: 'medium' }
        ],
        timeline: { estimated_hours: 40 },
        architecture: { type: 'client-server' }
      },
      created_at: new Date().toISOString()
    }

    this.projects.set(project.id, project)
    return project
  }

  // Mock Kiro build trigger
  async triggerKiroBuild(projectId: string): Promise<any> {
    const project = this.projects.get(projectId)
    if (!project) {
      throw new Error('Project not found')
    }

    const buildResult = {
      project_id: projectId,
      kiro_build_id: 'build-123',
      kiro_project_id: 'kiro-proj-123',
      status: 'build_triggered',
      estimated_completion: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }

    // Update project status
    project.status = 'building'
    project.kiro_build_id = buildResult.kiro_build_id
    this.projects.set(projectId, project)

    // Create initial build event
    const buildEvents = this.buildEvents.get(projectId) || []
    buildEvents.push({
      event_type: 'build_started',
      event_data: buildResult,
      message: 'Kiro build initiated successfully',
      timestamp: new Date().toISOString()
    })
    this.buildEvents.set(projectId, buildEvents)

    return buildResult
  }

  // Mock webhook processing
  async processKiroWebhook(payload: any): Promise<any> {
    const { build_id, event_type, data } = payload
    
    // Find project by build ID
    let projectId: string | null = null
    for (const [id, project] of this.projects.entries()) {
      if (project.kiro_build_id === build_id) {
        projectId = id
        break
      }
    }

    if (!projectId) {
      throw new Error('Project not found for build ID')
    }

    // Add build event
    const buildEvents = this.buildEvents.get(projectId) || []
    buildEvents.push({
      event_type,
      event_data: data,
      message: this.generateEventMessage(event_type, data),
      timestamp: new Date().toISOString()
    })
    this.buildEvents.set(projectId, buildEvents)

    // Update project status if needed
    const project = this.projects.get(projectId)!
    if (event_type === 'build_completed') {
      project.status = 'completed'
      project.completed_at = new Date().toISOString()
    } else if (event_type === 'build_failed') {
      project.status = 'failed'
      project.error_message = data?.error || 'Build failed'
    }
    this.projects.set(projectId, project)

    return { processed: true, project_id: projectId }
  }

  private generateEventMessage(eventType: string, data: any): string {
    switch (eventType) {
      case 'build_started':
        return 'Build process started'
      case 'build_progress':
        return `Build progress: ${data?.progress || 0}% complete`
      case 'build_completed':
        return 'Build completed successfully'
      case 'build_failed':
        return `Build failed: ${data?.error || 'Unknown error'}`
      default:
        return `Event: ${eventType}`
    }
  }

  // Get project status
  getProject(projectId: string): any {
    return this.projects.get(projectId)
  }

  // Get build events
  getBuildEvents(projectId: string): any[] {
    return this.buildEvents.get(projectId) || []
  }

  // Reset for testing
  reset() {
    this.conversations.clear()
    this.projects.clear()
    this.buildEvents.clear()
  }
}

const mockPipeline = new MockPipelineSystem()

Deno.test('Pipeline Integration - Complete Flow Success', async () => {
  setupTestEnvironment()
  mockPipeline.reset()

  const timer = new PerformanceTimer()
  timer.start()

  // Step 1: Analyze conversation
  const conversation = await mockPipeline.analyzeConversation('conv-123')
  assertExists(conversation)
  assertEquals(conversation.status, 'completed')
  assertExists(conversation.analysis)

  // Step 2: Generate project plan
  const project = await mockPipeline.generateProjectPlan('conv-123')
  assertExists(project)
  assertEquals(project.status, 'planning')
  assertExists(project.project_plan)
  assertEquals(project.project_plan.name, 'Todo Application')

  // Step 3: Trigger Kiro build
  const buildResult = await mockPipeline.triggerKiroBuild(project.id)
  assertExists(buildResult)
  assertEquals(buildResult.status, 'build_triggered')
  assertExists(buildResult.kiro_build_id)

  // Verify project status updated
  const updatedProject = mockPipeline.getProject(project.id)
  assertEquals(updatedProject.status, 'building')

  // Step 4: Process webhook events
  await mockPipeline.processKiroWebhook({
    build_id: buildResult.kiro_build_id,
    event_type: 'build_progress',
    data: { progress: 50, step: 'Generating components' }
  })

  await mockPipeline.processKiroWebhook({
    build_id: buildResult.kiro_build_id,
    event_type: 'build_completed',
    data: { deployment_url: 'https://app.example.com' }
  })

  // Verify final project status
  const finalProject = mockPipeline.getProject(project.id)
  assertEquals(finalProject.status, 'completed')
  assertExists(finalProject.completed_at)

  // Verify build events
  const buildEvents = mockPipeline.getBuildEvents(project.id)
  assertEquals(buildEvents.length, 3) // started, progress, completed
  assertEquals(buildEvents[0].event_type, 'build_started')
  assertEquals(buildEvents[1].event_type, 'build_progress')
  assertEquals(buildEvents[2].event_type, 'build_completed')

  timer.stop()
  timer.assertDurationLessThan(1000, 'Complete pipeline should execute quickly')
})

Deno.test('Pipeline Integration - Handle Build Failure', async () => {
  setupTestEnvironment()
  mockPipeline.reset()

  // Setup project
  const conversation = await mockPipeline.analyzeConversation('conv-456')
  const project = await mockPipeline.generateProjectPlan('conv-456')
  const buildResult = await mockPipeline.triggerKiroBuild(project.id)

  // Simulate build failure
  await mockPipeline.processKiroWebhook({
    build_id: buildResult.kiro_build_id,
    event_type: 'build_failed',
    data: { error: 'Compilation error in component.tsx' }
  })

  // Verify project status
  const failedProject = mockPipeline.getProject(project.id)
  assertEquals(failedProject.status, 'failed')
  assertEquals(failedProject.error_message, 'Compilation error in component.tsx')

  // Verify build events
  const buildEvents = mockPipeline.getBuildEvents(project.id)
  const failureEvent = buildEvents.find(e => e.event_type === 'build_failed')
  assertExists(failureEvent)
  assertEquals(failureEvent.event_data.error, 'Compilation error in component.tsx')
})

Deno.test('Pipeline Integration - Multiple Projects Concurrently', async () => {
  setupTestEnvironment()
  mockPipeline.reset()

  const timer = new PerformanceTimer()
  timer.start()

  // Process 5 projects concurrently
  const projectPromises = []
  for (let i = 0; i < 5; i++) {
    const conversationId = `conv-concurrent-${i}`
    
    const projectPromise = (async () => {
      const conversation = await mockPipeline.analyzeConversation(conversationId)
      const project = await mockPipeline.generateProjectPlan(conversationId)
      const buildResult = await mockPipeline.triggerKiroBuild(project.id)
      
      // Simulate some build events
      await mockPipeline.processKiroWebhook({
        build_id: buildResult.kiro_build_id,
        event_type: 'build_progress',
        data: { progress: 25 }
      })
      
      await mockPipeline.processKiroWebhook({
        build_id: buildResult.kiro_build_id,
        event_type: 'build_completed',
        data: { deployment_url: `https://app-${i}.example.com` }
      })
      
      return project.id
    })()
    
    projectPromises.push(projectPromise)
  }

  const projectIds = await Promise.all(projectPromises)
  timer.stop()

  // Verify all projects completed successfully
  assertEquals(projectIds.length, 5)
  
  for (const projectId of projectIds) {
    const project = mockPipeline.getProject(projectId)
    assertEquals(project.status, 'completed')
    
    const buildEvents = mockPipeline.getBuildEvents(projectId)
    assertEquals(buildEvents.length >= 2, true) // At least started and completed
  }

  timer.assertDurationLessThan(2000, 'Concurrent processing should be efficient')
})

Deno.test('Pipeline Integration - Error Handling and Recovery', async () => {
  setupTestEnvironment()
  mockPipeline.reset()

  // Test conversation analysis with invalid ID
  try {
    await mockPipeline.generateProjectPlan('invalid-conv-id')
    assertEquals(false, true, 'Should have thrown error for invalid conversation')
  } catch (error) {
    assertEquals(error.message, 'Conversation not found')
  }

  // Test build trigger with invalid project ID
  try {
    await mockPipeline.triggerKiroBuild('invalid-project-id')
    assertEquals(false, true, 'Should have thrown error for invalid project')
  } catch (error) {
    assertEquals(error.message, 'Project not found')
  }

  // Test webhook with invalid build ID
  try {
    await mockPipeline.processKiroWebhook({
      build_id: 'invalid-build-id',
      event_type: 'build_progress',
      data: { progress: 50 }
    })
    assertEquals(false, true, 'Should have thrown error for invalid build ID')
  } catch (error) {
    assertEquals(error.message, 'Project not found for build ID')
  }
})

Deno.test('Pipeline Integration - Performance Under Load', async () => {
  setupTestEnvironment()
  mockPipeline.reset()

  // Run load test with multiple concurrent users
  const loadTestResults = await runLoadTest(
    async () => {
      const conversationId = `conv-load-${Date.now()}-${Math.random()}`
      const conversation = await mockPipeline.analyzeConversation(conversationId)
      const project = await mockPipeline.generateProjectPlan(conversationId)
      const buildResult = await mockPipeline.triggerKiroBuild(project.id)
      
      // Quick completion
      await mockPipeline.processKiroWebhook({
        build_id: buildResult.kiro_build_id,
        event_type: 'build_completed',
        data: {}
      })
      
      return project.id
    },
    {
      concurrent: 10,
      duration: 5000, // 5 seconds
      rampUp: 1000    // 1 second ramp up
    }
  )

  // Verify performance metrics
  assertEquals(loadTestResults.failedRequests, 0, 'No requests should fail under normal load')
  assertEquals(loadTestResults.averageResponseTime < 500, true, 'Average response time should be reasonable')
  assertEquals(loadTestResults.totalRequests > 0, true, 'Should have processed some requests')

  console.log('Load test results:', {
    totalRequests: loadTestResults.totalRequests,
    successfulRequests: loadTestResults.successfulRequests,
    averageResponseTime: `${loadTestResults.averageResponseTime.toFixed(2)}ms`,
    maxResponseTime: `${loadTestResults.maxResponseTime.toFixed(2)}ms`
  })
})

Deno.test('Pipeline Integration - Data Consistency', async () => {
  setupTestEnvironment()
  mockPipeline.reset()

  // Create a project and track all state changes
  const conversation = await mockPipeline.analyzeConversation('conv-consistency')
  const project = await mockPipeline.generateProjectPlan('conv-consistency')
  const buildResult = await mockPipeline.triggerKiroBuild(project.id)

  // Verify initial state
  let currentProject = mockPipeline.getProject(project.id)
  assertEquals(currentProject.status, 'building')
  assertEquals(currentProject.kiro_build_id, buildResult.kiro_build_id)

  // Process multiple events and verify state consistency
  const events = [
    { event_type: 'build_progress', data: { progress: 25, step: 'Setup' } },
    { event_type: 'build_progress', data: { progress: 50, step: 'Components' } },
    { event_type: 'build_progress', data: { progress: 75, step: 'Testing' } },
    { event_type: 'build_completed', data: { deployment_url: 'https://app.example.com' } }
  ]

  for (const event of events) {
    await mockPipeline.processKiroWebhook({
      build_id: buildResult.kiro_build_id,
      ...event
    })

    // Verify state after each event
    currentProject = mockPipeline.getProject(project.id)
    const buildEvents = mockPipeline.getBuildEvents(project.id)
    
    // Events should be in chronological order
    const timestamps = buildEvents.map(e => new Date(e.timestamp).getTime())
    for (let i = 1; i < timestamps.length; i++) {
      assertEquals(timestamps[i] >= timestamps[i-1], true, 'Events should be chronologically ordered')
    }
  }

  // Final state verification
  assertEquals(currentProject.status, 'completed')
  assertExists(currentProject.completed_at)
  
  const finalBuildEvents = mockPipeline.getBuildEvents(project.id)
  assertEquals(finalBuildEvents.length, 5) // started + 4 events
  assertEquals(finalBuildEvents[finalBuildEvents.length - 1].event_type, 'build_completed')
})

Deno.test('Pipeline Integration - Real-time Event Broadcasting', async () => {
  setupTestEnvironment()
  mockPipeline.reset()

  // Mock WebSocket connections
  const mockConnections: Array<{ userId: string; projectId: string; events: any[] }> = []
  
  // Simulate multiple users subscribing to project updates
  for (let i = 0; i < 3; i++) {
    mockConnections.push({
      userId: `user-${i}`,
      projectId: '',
      events: []
    })
  }

  // Create project and simulate real-time updates
  const conversation = await mockPipeline.analyzeConversation('conv-realtime')
  const project = await mockPipeline.generateProjectPlan('conv-realtime')
  const buildResult = await mockPipeline.triggerKiroBuild(project.id)

  // Subscribe all connections to this project
  mockConnections.forEach(conn => {
    conn.projectId = project.id
  })

  // Simulate broadcasting events to all subscribers
  const broadcastEvent = (event: any) => {
    mockConnections.forEach(conn => {
      if (conn.projectId === project.id) {
        conn.events.push({
          ...event,
          timestamp: new Date().toISOString(),
          project_id: project.id
        })
      }
    })
  }

  // Process events and broadcast
  const events = [
    { event_type: 'build_progress', data: { progress: 30 } },
    { event_type: 'build_progress', data: { progress: 60 } },
    { event_type: 'build_completed', data: { deployment_url: 'https://app.example.com' } }
  ]

  for (const event of events) {
    await mockPipeline.processKiroWebhook({
      build_id: buildResult.kiro_build_id,
      ...event
    })
    
    // Broadcast to all connected clients
    broadcastEvent(event)
  }

  // Verify all connections received all events
  mockConnections.forEach((conn, index) => {
    assertEquals(conn.events.length, 3, `Connection ${index} should receive all events`)
    assertEquals(conn.events[0].event_type, 'build_progress')
    assertEquals(conn.events[1].event_type, 'build_progress')
    assertEquals(conn.events[2].event_type, 'build_completed')
    
    // Verify event data integrity
    assertEquals(conn.events[0].data.progress, 30)
    assertEquals(conn.events[1].data.progress, 60)
    assertEquals(conn.events[2].data.deployment_url, 'https://app.example.com')
  })
})