# Developer Guide - Automated Development Pipeline

This guide provides comprehensive information for developers working with or extending the Automated Development Pipeline system.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Development Setup](#development-setup)
3. [Code Structure](#code-structure)
4. [Development Workflow](#development-workflow)
5. [Testing](#testing)
6. [Debugging](#debugging)
7. [Contributing](#contributing)
8. [Best Practices](#best-practices)

## Architecture Overview

### System Components

The Automated Development Pipeline consists of several key components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Tavus API     │    │   Frontend      │    │   Kiro API      │
│  (Conversations)│    │   Dashboard     │    │  (Building)     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ Webhooks             │ API Calls            │ API Calls
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Supabase Edge Functions                         │
├─────────────────┬─────────────────┬─────────────────┬───────────┤
│ Tavus Webhook   │ Conversation    │ Project Plan    │ Kiro      │
│ Handler         │ Analysis        │ Generator       │ Integration│
├─────────────────┼─────────────────┼─────────────────┼───────────┤
│ Queue           │ Real-time       │ Monitoring      │ Security  │
│ Processor       │ Broadcasting    │ & Analytics     │ & Auth    │
└─────────────────┴─────────────────┴─────────────────┴───────────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Database                            │
├─────────────────┬─────────────────┬─────────────────┬───────────┤
│ Projects        │ Build Events    │ Processing      │ Audit     │
│ Conversations   │ Real-time       │ Queue           │ Logs      │
│                 │ Events          │                 │           │
└─────────────────┴─────────────────┴─────────────────┴───────────┘
```

### Data Flow

1. **Conversation End**: Tavus sends webhook when conversation ends
2. **Analysis**: AI analyzes transcript and extracts requirements
3. **Planning**: AI generates detailed project plan
4. **Building**: Kiro builds application based on plan
5. **Monitoring**: Real-time updates broadcast to clients
6. **Completion**: Deployed application URL provided

### Technology Stack

- **Runtime**: Deno (Edge Functions)
- **Database**: PostgreSQL (Supabase)
- **Real-time**: Supabase Real-time / WebSockets
- **AI**: OpenAI GPT-4 / Claude
- **Authentication**: JWT / Supabase Auth
- **Deployment**: Supabase Edge Functions

## Development Setup

### Prerequisites

1. **Deno** (v1.40+)
   ```bash
   curl -fsSL https://deno.land/install.sh | sh
   ```

2. **Supabase CLI**
   ```bash
   npm install -g @supabase/cli
   ```

3. **Git**
   ```bash
   # Clone the repository
   git clone https://github.com/your-org/automated-dev-pipeline.git
   cd automated-dev-pipeline
   ```

### Local Development Environment

1. **Start Supabase locally**
   ```bash
   cd supabase
   supabase start
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Run database migrations**
   ```bash
   supabase db reset
   ```

4. **Deploy functions locally**
   ```bash
   supabase functions serve
   ```

5. **Run tests**
   ```bash
   deno test --allow-all functions/_tests/
   ```

### Environment Configuration

Create `.env.local` with the following variables:

```bash
# Supabase (automatically set by supabase start)
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
SUPABASE_ANON_KEY=your-local-anon-key

# AI Services
OPENAI_API_KEY=your-openai-api-key
CLAUDE_API_KEY=your-claude-api-key

# External APIs
TAVUS_API_KEY=your-tavus-api-key
KIRO_API_KEY=your-kiro-api-key

# Security
JWT_SECRET=your-local-jwt-secret
ADMIN_TOKEN=your-local-admin-token

# Development
LOG_LEVEL=DEBUG
PIPELINE_ENABLED=true
```

## Code Structure

### Directory Layout

```
supabase/
├── functions/                    # Edge Functions
│   ├── _shared/                 # Shared utilities
│   │   ├── types.ts            # TypeScript type definitions
│   │   ├── utils.ts            # Utility functions
│   │   ├── database.ts         # Database service layer
│   │   └── ai-service.ts       # AI integration service
│   ├── _tests/                 # Test suite
│   │   ├── *.test.ts          # Unit tests
│   │   ├── run-tests.ts       # Test runner
│   │   └── test-utils.ts      # Test utilities
│   ├── analyze-conversation/   # Conversation analysis function
│   ├── generate-project-plan/  # Project plan generation
│   ├── trigger-kiro-build/     # Kiro build trigger
│   ├── kiro-webhook/          # Kiro webhook handler
│   ├── tavus-webhook/         # Tavus webhook handler
│   ├── process-queue/         # Queue processing
│   ├── system-monitor/        # System monitoring
│   ├── websocket-manager/     # WebSocket management
│   ├── broadcast-events/      # Event broadcasting
│   ├── auth-middleware/       # Authentication
│   ├── rate-limiter/          # Rate limiting
│   └── audit-logger/          # Audit logging
├── migrations/                 # Database migrations
│   ├── 001_initial_schema.sql
│   ├── 002_pipeline_schema.sql
│   └── 003_realtime_enhancements.sql
└── config.toml               # Supabase configuration
```

### Shared Modules

#### Types (`_shared/types.ts`)

Contains all TypeScript type definitions:

```typescript
export interface Project {
  id: number;
  conversation_id: string;
  project_name: string;
  status: ProjectStatus;
  // ... other fields
}

export type ProjectStatus = 
  | 'analyzing' 
  | 'planning' 
  | 'ready_to_build' 
  | 'building' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';
```

#### Database Service (`_shared/database.ts`)

Provides database abstraction layer:

```typescript
export class DatabaseService {
  public projects: ProjectService;
  public buildEvents: BuildEventService;
  public queue: QueueService;
  // ... other services

  static create(): DatabaseService {
    const supabase = createSupabaseClient();
    return new DatabaseService(supabase);
  }
}
```

#### Utilities (`_shared/utils.ts`)

Common utility functions:

```typescript
export class Logger {
  constructor(private context: string) {}
  
  info(message: string, data?: any) {
    // Structured logging implementation
  }
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  // Retry logic with exponential backoff
}
```

### Function Structure

Each Edge Function follows a consistent structure:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DatabaseService } from '../_shared/database.ts'
import { Logger, createCorsHeaders, createJsonResponse } from '../_shared/utils.ts'

const logger = new Logger('FunctionName')

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createCorsHeaders() })
  }

  try {
    // Function logic here
    const db = DatabaseService.create()
    
    // Process request
    const result = await processRequest(req, db)
    
    return createJsonResponse(result)
  } catch (error) {
    logger.error('Function failed', error)
    return createErrorResponse('Function failed', 500)
  }
})
```

## Development Workflow

### 1. Feature Development

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Implement changes**
   - Add/modify Edge Functions
   - Update shared utilities if needed
   - Add database migrations if required

3. **Write tests**
   ```bash
   # Create test file
   touch supabase/functions/_tests/your-feature.test.ts
   
   # Write unit tests
   # Write integration tests
   ```

4. **Test locally**
   ```bash
   # Run specific test
   deno test --allow-all functions/_tests/your-feature.test.ts
   
   # Run all tests
   deno test --allow-all functions/_tests/
   
   # Run integration tests
   deno run --allow-all functions/_tests/run-tests.ts
   ```

5. **Deploy to staging**
   ```bash
   ./scripts/deploy.sh staging
   ```

### 2. Database Changes

1. **Create migration**
   ```bash
   supabase migration new your_migration_name
   ```

2. **Write migration SQL**
   ```sql
   -- supabase/migrations/004_your_migration.sql
   ALTER TABLE projects ADD COLUMN new_field TEXT;
   CREATE INDEX idx_projects_new_field ON projects(new_field);
   ```

3. **Test migration**
   ```bash
   supabase db reset  # Applies all migrations
   ```

4. **Update types**
   ```typescript
   // Update interface in _shared/types.ts
   export interface Project {
     // ... existing fields
     new_field?: string;
   }
   ```

### 3. Adding New Functions

1. **Create function directory**
   ```bash
   mkdir supabase/functions/your-new-function
   ```

2. **Create function file**
   ```typescript
   // supabase/functions/your-new-function/index.ts
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
   // ... implement function
   ```

3. **Add to deployment**
   Functions are automatically deployed when in the `functions/` directory

4. **Add tests**
   ```typescript
   // supabase/functions/_tests/your-new-function.test.ts
   import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts"
   // ... write tests
   ```

## Testing

### Test Structure

Tests are organized in the `_tests/` directory:

- **Unit tests**: Test individual functions and utilities
- **Integration tests**: Test end-to-end workflows
- **Performance tests**: Test system performance under load

### Running Tests

```bash
# Run all tests
deno test --allow-all functions/_tests/

# Run specific test file
deno test --allow-all functions/_tests/auth-middleware.test.ts

# Run with coverage
deno test --allow-all --coverage=coverage functions/_tests/

# Generate coverage report
deno coverage coverage --lcov > coverage.lcov
```

### Writing Tests

#### Unit Test Example

```typescript
import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import { validateProjectPlan } from "../_shared/utils.ts"

Deno.test("validateProjectPlan - valid plan", () => {
  const validPlan = {
    name: "Test Project",
    description: "A test project",
    techStack: {
      frontend: ["React"],
      backend: ["Node.js"],
      database: "PostgreSQL"
    },
    features: [
      { id: "1", name: "Feature 1", description: "Test feature" }
    ]
  }
  
  assertEquals(validateProjectPlan(validPlan), true)
})

Deno.test("validateProjectPlan - invalid plan", () => {
  const invalidPlan = { name: "Test" } // Missing required fields
  
  assertRejects(
    () => validateProjectPlan(invalidPlan),
    Error,
    "Missing required field"
  )
})
```

#### Integration Test Example

```typescript
import { createTestClient, cleanupTestData } from "./test-utils.ts"

Deno.test("End-to-end pipeline flow", async () => {
  const client = createTestClient()
  
  try {
    // 1. Trigger conversation analysis
    const analysisResponse = await client.analyzeConversation({
      conversation_id: "test_conv_123",
      transcript_url: "https://example.com/transcript"
    })
    
    assertEquals(analysisResponse.status, "analysis_complete")
    
    // 2. Generate project plan
    const planResponse = await client.generateProjectPlan({
      project_id: analysisResponse.project_id
    })
    
    assertEquals(planResponse.plan_generated, true)
    
    // 3. Trigger build
    const buildResponse = await client.triggerBuild({
      project_id: analysisResponse.project_id
    })
    
    assertEquals(buildResponse.build_triggered, true)
    
  } finally {
    await cleanupTestData()
  }
})
```

### Test Utilities

The `test-utils.ts` file provides common testing utilities:

```typescript
export function createTestClient() {
  return new PipelineClient({
    baseUrl: 'http://localhost:54321/functions/v1',
    apiKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  })
}

export async function createTestProject() {
  // Create test project data
}

export async function cleanupTestData() {
  // Clean up test data
}
```

## Debugging

### Local Debugging

1. **Enable debug logging**
   ```bash
   export LOG_LEVEL=DEBUG
   ```

2. **Use console logging**
   ```typescript
   console.log('Debug info:', { data })
   logger.debug('Detailed debug info', { context })
   ```

3. **Inspect database state**
   ```bash
   supabase db shell
   ```

4. **Monitor function logs**
   ```bash
   supabase functions logs --follow
   ```

### Remote Debugging

1. **View function logs**
   ```bash
   supabase functions logs --project-ref your-project-id
   ```

2. **Monitor system health**
   ```bash
   curl "https://your-project.supabase.co/functions/v1/system-monitor?action=health"
   ```

3. **Check error rates**
   ```bash
   curl "https://your-project.supabase.co/functions/v1/system-monitor?action=errors&timeframe=1h"
   ```

### Common Issues

#### Function Timeout
```typescript
// Use timeout wrapper for long operations
import { timeout } from '../_shared/utils.ts'

const result = await timeout(
  longRunningOperation(),
  30000 // 30 second timeout
)
```

#### Memory Issues
```typescript
// Clean up large objects
import { cleanupLargeObjects } from '../_shared/utils.ts'

try {
  const largeData = await processLargeDataset()
  // ... use data
} finally {
  cleanupLargeObjects(largeData)
}
```

#### Database Connection Issues
```typescript
// Use retry logic for database operations
import { retryWithBackoff } from '../_shared/utils.ts'

const result = await retryWithBackoff(
  () => db.projects.getProject(id),
  { maxRetries: 3, delays: [100, 500, 1000] }
)
```

## Contributing

### Code Style

1. **TypeScript**: Use strict TypeScript with proper typing
2. **Formatting**: Use Deno's built-in formatter
3. **Linting**: Follow Deno's linting rules
4. **Naming**: Use descriptive names for functions and variables

### Commit Guidelines

```bash
# Format: type(scope): description
git commit -m "feat(auth): add API key authentication"
git commit -m "fix(webhook): handle missing signature header"
git commit -m "docs(api): update authentication examples"
```

### Pull Request Process

1. **Create feature branch** from `develop`
2. **Implement changes** with tests
3. **Update documentation** if needed
4. **Run full test suite**
5. **Create pull request** to `develop`
6. **Address review feedback**
7. **Merge after approval**

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] Error handling is comprehensive
- [ ] Security considerations are addressed
- [ ] Performance impact is considered

## Best Practices

### Error Handling

```typescript
// Use custom error types
import { PipelineError, AIAnalysisError } from '../_shared/types.ts'

try {
  const result = await aiService.analyzeConversation(transcript)
} catch (error) {
  if (error instanceof AIAnalysisError) {
    // Handle AI-specific errors
    logger.warn('AI analysis failed', error)
    return createErrorResponse('Analysis failed', 422, 'AI_ERROR')
  }
  
  // Handle unexpected errors
  logger.error('Unexpected error', error)
  return createErrorResponse('Internal error', 500, 'INTERNAL_ERROR')
}
```

### Logging

```typescript
// Use structured logging
logger.info('Processing request', {
  user_id: userId,
  project_id: projectId,
  request_id: requestId
})

// Include context in error logs
logger.error('Database operation failed', error, {
  operation: 'updateProject',
  project_id: projectId,
  retry_count: retryCount
})
```

### Performance

```typescript
// Use performance monitoring
const monitor = new PerformanceMonitor(logger)

// Mark important milestones
monitor.mark('db_initialized')
monitor.mark('ai_analysis_complete')
monitor.mark('project_created')

// Log performance metrics
const totalTime = monitor.getTotalTime()
logger.info('Request completed', {
  total_time_ms: totalTime.toFixed(2),
  metrics: monitor.getMetrics()
})
```

### Security

```typescript
// Validate input data
import { validateRequired } from '../_shared/utils.ts'

try {
  validateRequired(requestData, ['user_id', 'project_id'])
} catch (error) {
  return createErrorResponse(error.message, 400, 'VALIDATION_ERROR')
}

// Use rate limiting
const rateLimitResult = await checkRateLimit(userId, 'api_general')
if (!rateLimitResult.allowed) {
  return createErrorResponse('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED')
}
```

### Database Operations

```typescript
// Use transactions for related operations
const { data, error } = await db.supabase.rpc('create_project_with_events', {
  project_data: projectData,
  initial_events: events
})

// Use proper error handling
if (error) {
  throw new DatabaseError(`Failed to create project: ${error.message}`)
}
```

---

For more information, see the [API Documentation](./api-documentation.md) and [Troubleshooting Guide](./troubleshooting-guide.md).