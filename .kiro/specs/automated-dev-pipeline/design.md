# Automated Development Pipeline - Design Document

## Overview

The automated development pipeline transforms the Tech Co-Founder application from a simple landing page into a comprehensive development automation system. The backend pipeline consists of multiple Supabase Edge Functions that work together to analyze conversations, generate project plans, and manage Kiro builds.

## Architecture

### System Flow
```
Tavus Conversation End → Webhook → Analysis → Project Plan → Kiro API → Real-time Updates
```

### Core Components
1. **Conversation Processor** - Analyzes Tavus transcripts
2. **Project Plan Generator** - Creates structured development plans  
3. **Kiro Integration Service** - Manages Kiro API interactions
4. **Real-time Event System** - Handles WebSocket updates
5. **Queue Management** - Handles concurrent processing

## Components and Interfaces

### 1. Enhanced Database Schema

#### New Tables
```sql
-- Projects table for managing development projects
CREATE TABLE projects (
  id BIGSERIAL PRIMARY KEY,
  conversation_id VARCHAR(255) REFERENCES conversations(conversation_id),
  project_name VARCHAR(255) NOT NULL,
  project_description TEXT,
  conversation_summary TEXT,
  project_plan JSONB,
  kiro_build_id VARCHAR(255),
  kiro_project_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'analyzing', -- analyzing, planning, building, completed, failed
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

-- Build events for tracking Kiro build progress
CREATE TABLE build_events (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT REFERENCES projects(id),
  kiro_build_id VARCHAR(255),
  event_type VARCHAR(100) NOT NULL, -- started, progress, completed, failed, log
  event_data JSONB DEFAULT '{}',
  message TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  sequence_number INTEGER
);

-- Processing queue for managing pipeline tasks
CREATE TABLE processing_queue (
  id BIGSERIAL PRIMARY KEY,
  task_type VARCHAR(100) NOT NULL, -- analyze_conversation, generate_plan, trigger_build
  task_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  priority INTEGER DEFAULT 1,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- API rate limiting and usage tracking
CREATE TABLE api_usage (
  id BIGSERIAL PRIMARY KEY,
  api_name VARCHAR(100) NOT NULL, -- tavus, openai, kiro
  endpoint VARCHAR(255),
  request_count INTEGER DEFAULT 1,
  response_time_ms INTEGER,
  status_code INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id VARCHAR(255),
  project_id BIGINT
);
```

#### Indexes for Performance
```sql
CREATE INDEX idx_projects_conversation_id ON projects(conversation_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_kiro_build_id ON projects(kiro_build_id);
CREATE INDEX idx_build_events_project_id ON build_events(project_id);
CREATE INDEX idx_build_events_timestamp ON build_events(timestamp);
CREATE INDEX idx_processing_queue_status ON processing_queue(status);
CREATE INDEX idx_processing_queue_priority ON processing_queue(priority, created_at);
CREATE INDEX idx_api_usage_created_at ON api_usage(created_at);
```

### 2. Supabase Edge Functions

#### A. Enhanced Tavus Webhook (`tavus-webhook/index.ts`)
```typescript
// Enhanced to trigger pipeline when conversation ends
serve(async (req) => {
  const { event_type, conversation_id, data } = await req.json();
  
  // Store webhook event
  await storeWebhookEvent(conversation_id, event_type, data);
  
  // Trigger pipeline for conversation end
  if (event_type === 'conversation_ended') {
    await queueTask('analyze_conversation', {
      conversation_id,
      transcript_url: data.transcript_url,
      summary: data.summary
    });
  }
  
  return new Response(JSON.stringify({ received: true }));
});
```

#### B. Conversation Analysis Function (`analyze-conversation/index.ts`)
```typescript
serve(async (req) => {
  const { conversation_id, transcript_url, summary } = await req.json();
  
  try {
    // 1. Retrieve conversation transcript from Tavus
    const transcript = await fetchTavusTranscript(transcript_url);
    
    // 2. Analyze with OpenAI/Claude
    const analysis = await analyzeConversationWithAI(transcript, summary);
    
    // 3. Create project record
    const project = await createProject({
      conversation_id,
      project_name: analysis.projectName,
      project_description: analysis.description,
      conversation_summary: analysis.summary,
      status: 'planning'
    });
    
    // 4. Queue project plan generation
    await queueTask('generate_plan', {
      project_id: project.id,
      requirements: analysis.requirements,
      preferences: analysis.preferences
    });
    
    return new Response(JSON.stringify({ project_id: project.id }));
  } catch (error) {
    await handlePipelineError('analyze_conversation', error, { conversation_id });
    throw error;
  }
});
```

#### C. Project Plan Generator (`generate-project-plan/index.ts`)
```typescript
serve(async (req) => {
  const { project_id, requirements, preferences } = await req.json();
  
  try {
    // 1. Generate comprehensive project plan
    const projectPlan = await generateProjectPlanWithAI({
      requirements,
      preferences,
      template: 'full-stack-web-app'
    });
    
    // 2. Validate plan structure
    const validatedPlan = await validateProjectPlan(projectPlan);
    
    // 3. Update project with plan
    await updateProject(project_id, {
      project_plan: validatedPlan,
      status: 'ready_to_build'
    });
    
    // 4. Queue Kiro build trigger
    await queueTask('trigger_build', {
      project_id,
      project_plan: validatedPlan
    });
    
    return new Response(JSON.stringify({ 
      project_id, 
      plan_generated: true 
    }));
  } catch (error) {
    await handlePipelineError('generate_plan', error, { project_id });
    throw error;
  }
});
```

#### D. Kiro Build Trigger (`trigger-kiro-build/index.ts`)
```typescript
serve(async (req) => {
  const { project_id, project_plan } = await req.json();
  
  try {
    // 1. Format plan for Kiro API
    const kiroPayload = await formatForKiroAPI(project_plan);
    
    // 2. Call Kiro API
    const kiroResponse = await fetch('https://api.kiro.dev/v1/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('KIRO_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...kiroPayload,
        webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/kiro-webhook`,
        real_time_updates: true,
        metadata: { project_id }
      })
    });
    
    if (!kiroResponse.ok) {
      throw new Error(`Kiro API error: ${kiroResponse.statusText}`);
    }
    
    const { build_id, project_id: kiro_project_id } = await kiroResponse.json();
    
    // 3. Update project with Kiro IDs
    await updateProject(project_id, {
      kiro_build_id: build_id,
      kiro_project_id,
      status: 'building'
    });
    
    // 4. Create initial build event
    await createBuildEvent(project_id, 'build_started', {
      kiro_build_id: build_id,
      kiro_project_id
    });
    
    return new Response(JSON.stringify({ 
      project_id, 
      kiro_build_id: build_id 
    }));
  } catch (error) {
    await handlePipelineError('trigger_build', error, { project_id });
    throw error;
  }
});
```

#### E. Kiro Webhook Handler (`kiro-webhook/index.ts`)
```typescript
serve(async (req) => {
  const { 
    build_id, 
    project_id: kiro_project_id, 
    event_type, 
    data, 
    metadata 
  } = await req.json();
  
  try {
    const project_id = metadata?.project_id;
    
    // 1. Store build event
    await createBuildEvent(project_id, event_type, {
      kiro_build_id: build_id,
      kiro_project_id,
      ...data
    });
    
    // 2. Update project status based on event
    let statusUpdate = {};
    switch (event_type) {
      case 'build_progress':
        statusUpdate = { 
          status: 'building',
          metadata: { progress: data.progress }
        };
        break;
      case 'build_completed':
        statusUpdate = { 
          status: 'completed',
          completed_at: new Date().toISOString()
        };
        break;
      case 'build_failed':
        statusUpdate = { 
          status: 'failed',
          error_message: data.error
        };
        break;
    }
    
    if (Object.keys(statusUpdate).length > 0) {
      await updateProject(project_id, statusUpdate);
    }
    
    // 3. Broadcast real-time update
    await broadcastUpdate(project_id, {
      event_type,
      data,
      timestamp: new Date().toISOString()
    });
    
    return new Response(JSON.stringify({ received: true }));
  } catch (error) {
    console.error('Kiro webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500
    });
  }
});
```

#### F. Queue Processor (`process-queue/index.ts`)
```typescript
serve(async (req) => {
  try {
    // 1. Get pending tasks with priority ordering
    const tasks = await getPendingTasks();
    
    // 2. Process tasks concurrently with limits
    const results = await Promise.allSettled(
      tasks.map(task => processTask(task))
    );
    
    // 3. Handle results and retries
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const task = tasks[i];
      
      if (result.status === 'rejected') {
        await handleTaskFailure(task, result.reason);
      } else {
        await markTaskCompleted(task.id);
      }
    }
    
    return new Response(JSON.stringify({ 
      processed: tasks.length,
      successful: results.filter(r => r.status === 'fulfilled').length
    }));
  } catch (error) {
    console.error('Queue processing error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500
    });
  }
});
```

### 3. AI Integration Services

#### OpenAI/Claude Integration
```typescript
// Conversation analysis with structured output
const analyzeConversationWithAI = async (transcript: string, summary?: string) => {
  const prompt = `
    Analyze this conversation transcript and extract:
    1. Project name and description
    2. Key requirements and features
    3. Technical preferences
    4. Timeline and priority
    
    Transcript: ${transcript}
    Summary: ${summary || 'None provided'}
    
    Return structured JSON with: projectName, description, requirements[], preferences{}, timeline, priority
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });
  
  return JSON.parse(response.choices[0].message.content);
};

// Project plan generation
const generateProjectPlanWithAI = async (input: any) => {
  const prompt = `
    Generate a comprehensive project plan for Kiro API consumption:
    Requirements: ${JSON.stringify(input.requirements)}
    Preferences: ${JSON.stringify(input.preferences)}
    
    Include: architecture, tech stack, features, timeline, file structure
    Format for Kiro API compatibility
  `;
  
  // Similar OpenAI call with structured output
};
```

## Data Models

### Project Plan Structure
```typescript
interface ProjectPlan {
  name: string;
  description: string;
  techStack: {
    frontend: string[];
    backend: string[];
    database: string;
    deployment: string;
  };
  features: Feature[];
  architecture: {
    type: 'monolith' | 'microservices' | 'serverless';
    components: Component[];
  };
  timeline: {
    estimated_hours: number;
    phases: Phase[];
  };
  fileStructure: FileNode[];
  dependencies: Dependency[];
}

interface Feature {
  id: string;
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  complexity: number;
  dependencies: string[];
}
```

## Error Handling

### Retry Strategy
```typescript
const retryWithBackoff = async (fn: Function, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
```

### Error Classification
- **Transient Errors**: Network issues, rate limits → Retry
- **Permanent Errors**: Invalid data, auth failures → Fail immediately  
- **Critical Errors**: System failures → Alert administrators

## Testing Strategy

### Unit Tests
- Individual function testing with mocked dependencies
- Database operation testing with test data
- AI integration testing with mock responses

### Integration Tests  
- End-to-end pipeline testing
- Webhook handling verification
- Queue processing validation

### Performance Tests
- Concurrent request handling
- Database query optimization
- Memory usage monitoring

This design provides a robust, scalable backend pipeline that can handle the automated development workflow efficiently while maintaining reliability and performance.