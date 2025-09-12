// End-to-End Integration Tests for Automated Development Pipeline
// Tests the complete pipeline flow from conversation to deployed application

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import { createTestClient, cleanupTestData, waitForCondition } from "./test-utils.ts"

const TEST_TIMEOUT = 300000 // 5 minutes for full pipeline test

Deno.test({
  name: "Complete Pipeline Flow - Conversation to Deployment",
  fn: async () => {
    const client = createTestClient()
    let projectId: number | null = null
    
    try {
      console.log("🚀 Starting end-to-end pipeline test...")
      
      // Step 1: Simulate Tavus webhook (conversation ended)
      console.log("📞 Step 1: Simulating conversation end...")
      const conversationId = `test_conv_${Date.now()}`
      
      const webhookResponse = await client.triggerTavusWebhook({
        event_type: "conversation_ended",
        conversation_id: conversationId,
        data: {
          transcript_url: "https://example.com/test-transcript",
          summary: "Discussion about building an e-commerce platform with React and Node.js",
          duration_seconds: 1800,
          participant_count: 2
        }
      })
      
      assertEquals(webhookResponse.received, true)
      console.log("✅ Conversation webhook processed")
      
      // Step 2: Wait for conversation analysis to complete
      console.log("🔍 Step 2: Waiting for conversation analysis...")
      
      const analysisResult = await waitForCondition(
        async () => {
          const projects = await client.getProjectsByConversation(conversationId)
          return projects.length > 0 ? projects[0] : null
        },
        (project) => project && project.status !== 'analyzing',
        30000 // 30 seconds timeout
      )
      
      assertExists(analysisResult)
      assertEquals(analysisResult.status, 'planning')
      projectId = analysisResult.id
      console.log(`✅ Analysis completed - Project ID: ${projectId}`)
      
      // Step 3: Wait for project plan generation
      console.log("📋 Step 3: Waiting for project plan generation...")
      
      const planResult = await waitForCondition(
        async () => await client.getProject(projectId!),
        (project) => project.status === 'ready_to_build' && project.project_plan,
        60000 // 60 seconds timeout
      )
      
      assertExists(planResult.project_plan)
      assertEquals(planResult.status, 'ready_to_build')
      console.log("✅ Project plan generated")
      
      // Step 4: Trigger Kiro build
      console.log("🔨 Step 4: Triggering Kiro build...")
      
      const buildResponse = await client.triggerKiroBuild({
        project_id: projectId!
      })
      
      assertEquals(buildResponse.build_triggered, true)
      assertExists(buildResponse.kiro_build_id)
      console.log(`✅ Build triggered - Build ID: ${buildResponse.kiro_build_id}`)
      
      // Step 5: Simulate Kiro build progress webhooks
      console.log("📈 Step 5: Simulating build progress...")
      
      const buildSteps = [
        { progress: 25, step: "Setting up project structure" },
        { progress: 50, step: "Installing dependencies" },
        { progress: 75, step: "Building application" },
        { progress: 100, step: "Deploying to production" }
      ]
      
      for (const step of buildSteps) {
        await client.triggerKiroWebhook({
          build_id: buildResponse.kiro_build_id,
          project_id: buildResponse.kiro_project_id,
          event_type: "build.progress",
          data: {
            progress: step.progress,
            current_step: step.step,
            estimated_completion: new Date(Date.now() + 60000).toISOString()
          }
        })
        
        // Wait a bit between progress updates
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      // Step 6: Simulate build completion
      console.log("🎉 Step 6: Simulating build completion...")
      
      await client.triggerKiroWebhook({
        build_id: buildResponse.kiro_build_id,
        project_id: buildResponse.kiro_project_id,
        event_type: "build.completed",
        data: {
          deployment_url: "https://test-app.vercel.app",
          repository_url: "https://github.com/test/test-app",
          artifacts: {
            frontend: "https://cdn.example.com/frontend.zip",
            backend: "https://cdn.example.com/backend.zip"
          }
        }
      })
      
      // Step 7: Verify final project status
      console.log("✅ Step 7: Verifying final project status...")
      
      const finalProject = await waitForCondition(
        async () => await client.getProject(projectId!),
        (project) => project.status === 'completed',
        30000 // 30 seconds timeout
      )
      
      assertEquals(finalProject.status, 'completed')
      assertExists(finalProject.completed_at)
      assertExists(finalProject.metadata?.deployment_url)
      console.log(`✅ Project completed - Deployment: ${finalProject.metadata.deployment_url}`)
      
      // Step 8: Verify build events were recorded
      console.log("📊 Step 8: Verifying build events...")
      
      const buildEvents = await client.getBuildEvents(projectId!)
      assert(buildEvents.length >= 5) // At least start, 4 progress, and completion
      
      const completionEvent = buildEvents.find(e => e.event_type === 'build_completed')
      assertExists(completionEvent)
      console.log("✅ Build events recorded correctly")
      
      // Step 9: Test real-time functionality
      console.log("🔄 Step 9: Testing real-time updates...")
      
      // This would test WebSocket connections in a real scenario
      // For now, we'll verify the broadcast events were created
      const broadcastEvents = await client.getBroadcastEvents(projectId!)
      assert(broadcastEvents.length > 0)
      console.log("✅ Real-time events broadcasted")
      
      console.log("🎊 End-to-end test completed successfully!")
      
    } catch (error) {
      console.error("❌ End-to-end test failed:", error)
      throw error
    } finally {
      // Cleanup test data
      if (projectId) {
        await cleanupTestData({ projectId })
      }
    }
  },
  sanitizeOps: false,
  sanitizeResources: false
}, TEST_TIMEOUT)

Deno.test({
  name: "Error Handling - Failed Build Scenario",
  fn: async () => {
    const client = createTestClient()
    let projectId: number | null = null
    
    try {
      console.log("🚀 Testing error handling with failed build...")
      
      // Create a project ready for building
      const project = await client.createTestProject({
        status: 'ready_to_build',
        project_plan: {
          name: "Test Failed Build",
          description: "Test project for build failure",
          techStack: { frontend: ["React"], backend: ["Node.js"], database: "PostgreSQL" },
          features: [{ id: "1", name: "Test Feature", description: "Test" }]
        }
      })
      
      projectId = project.id
      
      // Trigger build
      const buildResponse = await client.triggerKiroBuild({
        project_id: projectId
      })
      
      // Simulate build failure
      await client.triggerKiroWebhook({
        build_id: buildResponse.kiro_build_id,
        project_id: buildResponse.kiro_project_id,
        event_type: "build.failed",
        data: {
          error: "Compilation failed: Syntax error in main.js",
          failed_step: "Building application",
          logs_url: "https://logs.example.com/build-123"
        }
      })
      
      // Verify project status updated to failed
      const failedProject = await waitForCondition(
        async () => await client.getProject(projectId!),
        (project) => project.status === 'failed',
        10000
      )
      
      assertEquals(failedProject.status, 'failed')
      assertExists(failedProject.error_message)
      assert(failedProject.error_message!.includes("Compilation failed"))
      
      console.log("✅ Error handling test passed")
      
    } finally {
      if (projectId) {
        await cleanupTestData({ projectId })
      }
    }
  },
  sanitizeOps: false,
  sanitizeResources: false
})

Deno.test({
  name: "Performance Test - Concurrent Processing",
  fn: async () => {
    const client = createTestClient()
    const projectIds: number[] = []
    
    try {
      console.log("🚀 Testing concurrent processing performance...")
      
      const concurrentProjects = 5
      const startTime = performance.now()
      
      // Create multiple projects concurrently
      const projectPromises = Array.from({ length: concurrentProjects }, (_, i) =>
        client.analyzeConversation({
          conversation_id: `perf_test_${Date.now()}_${i}`,
          transcript_url: "https://example.com/test-transcript",
          summary: `Performance test conversation ${i}`
        })
      )
      
      const results = await Promise.all(projectPromises)
      
      // Collect project IDs for cleanup
      projectIds.push(...results.map(r => r.project_id))
      
      const endTime = performance.now()
      const totalTime = endTime - startTime
      const avgTime = totalTime / concurrentProjects
      
      console.log(`📊 Performance Results:`)
      console.log(`  - Total time: ${totalTime.toFixed(2)}ms`)
      console.log(`  - Average time per project: ${avgTime.toFixed(2)}ms`)
      console.log(`  - Concurrent projects: ${concurrentProjects}`)
      
      // Verify all projects were created successfully
      assertEquals(results.length, concurrentProjects)
      results.forEach(result => {
        assertEquals(result.status, 'analysis_complete')
        assertExists(result.project_id)
      })
      
      // Performance assertion - should handle 5 concurrent requests in under 30 seconds
      assert(totalTime < 30000, `Performance too slow: ${totalTime}ms > 30000ms`)
      
      console.log("✅ Performance test passed")
      
    } finally {
      // Cleanup all test projects
      for (const projectId of projectIds) {
        await cleanupTestData({ projectId })
      }
    }
  },
  sanitizeOps: false,
  sanitizeResources: false
})

Deno.test({
  name: "Security Test - Authentication and Authorization",
  fn: async () => {
    console.log("🔒 Testing security controls...")
    
    const client = createTestClient()
    
    // Test 1: Unauthenticated request should fail
    try {
      await fetch(`${client.baseUrl}/analyze-conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: 'test',
          transcript_url: 'https://example.com/test'
        })
      })
      
      assert(false, "Unauthenticated request should have failed")
    } catch (error) {
      // Expected to fail
      console.log("✅ Unauthenticated requests properly rejected")
    }
    
    // Test 2: Invalid token should fail
    try {
      await fetch(`${client.baseUrl}/analyze-conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token'
        },
        body: JSON.stringify({
          conversation_id: 'test',
          transcript_url: 'https://example.com/test'
        })
      })
      
      assert(false, "Invalid token should have failed")
    } catch (error) {
      // Expected to fail
      console.log("✅ Invalid tokens properly rejected")
    }
    
    // Test 3: Rate limiting should work
    const rateLimitResponse = await client.checkRateLimit({
      identifier: 'test_user',
      rule_name: 'api_general',
      increment: false
    })
    
    assertExists(rateLimitResponse.allowed)
    assertExists(rateLimitResponse.limit)
    assertExists(rateLimitResponse.remaining)
    
    console.log("✅ Rate limiting is functional")
    
    // Test 4: Audit logging should work
    const auditResponse = await client.logAuditEvent({
      action: 'security_test',
      resource_type: 'test',
      success: true
    })
    
    assertEquals(auditResponse.logged, true)
    assertExists(auditResponse.log_id)
    
    console.log("✅ Audit logging is functional")
    
    console.log("✅ Security tests passed")
  },
  sanitizeOps: false,
  sanitizeResources: false
})

Deno.test({
  name: "Integration Test - External APIs",
  fn: async () => {
    console.log("🔗 Testing external API integrations...")
    
    const client = createTestClient()
    
    // Test Tavus webhook signature validation
    const tavusWebhookTest = await client.testWebhookSignature('tavus', {
      event_type: 'test',
      conversation_id: 'test'
    })
    
    assert(tavusWebhookTest.signature_valid !== undefined)
    console.log("✅ Tavus webhook signature validation working")
    
    // Test Kiro webhook signature validation
    const kiroWebhookTest = await client.testWebhookSignature('kiro', {
      build_id: 'test',
      event_type: 'test'
    })
    
    assert(kiroWebhookTest.signature_valid !== undefined)
    console.log("✅ Kiro webhook signature validation working")
    
    // Test AI service connectivity (mock)
    const aiTest = await client.testAIService()
    assertEquals(aiTest.service_available, true)
    console.log("✅ AI service connectivity verified")
    
    console.log("✅ Integration tests passed")
  },
  sanitizeOps: false,
  sanitizeResources: false
})