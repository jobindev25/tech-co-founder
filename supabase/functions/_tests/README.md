# Automated Development Pipeline Test Suite

This directory contains comprehensive tests for the automated development pipeline, including unit tests, integration tests, performance tests, and load tests.

## Test Structure

```
_tests/
├── README.md                    # This file
├── test-utils.ts               # Shared testing utilities and mocks
├── run-tests.ts                # Test runner script
├── auth-middleware.test.ts     # Authentication middleware tests
├── rate-limiter.test.ts        # Rate limiting system tests
├── pipeline-integration.test.ts # End-to-end integration tests
└── performance.test.ts         # Performance and load tests
```

## Running Tests

### Quick Start

```bash
# Run all tests
deno run --allow-all _tests/run-tests.ts

# Run with verbose output
deno run --allow-all _tests/run-tests.ts --verbose

# Run specific test suite
deno run --allow-all _tests/run-tests.ts --filter "auth"

# Run tests in parallel
deno run --allow-all _tests/run-tests.ts --parallel

# Generate JUnit report
deno run --allow-all _tests/run-tests.ts --junit
```

### Individual Test Files

```bash
# Run specific test file
deno test --allow-all auth-middleware.test.ts

# Run with coverage
deno test --allow-all --coverage=coverage auth-middleware.test.ts

# Run performance tests only
deno test --allow-all performance.test.ts
```

## Test Categories

### 1. Unit Tests

**Files:** `auth-middleware.test.ts`, `rate-limiter.test.ts`

Tests individual components in isolation:
- Authentication flows (login, register, token verification)
- Rate limiting logic and rules
- Input validation and error handling
- Security features and edge cases

### 2. Integration Tests

**File:** `pipeline-integration.test.ts`

Tests complete workflows:
- End-to-end conversation → project → build pipeline
- Webhook processing and event handling
- Real-time broadcasting and notifications
- Error handling and recovery scenarios
- Data consistency across components

### 3. Performance Tests

**File:** `performance.test.ts`

Tests system performance and scalability:
- Response time benchmarks
- Concurrent user load testing
- High throughput scenarios
- Memory usage monitoring
- Stress testing and recovery

## Test Utilities

### MockSupabaseClient

Provides a complete mock implementation of the Supabase client:

```typescript
const mockDb = new MockSupabaseClient()

// Set up test data
mockDb.setMockData('users', [
  { id: 'user-1', email: 'test@example.com', role: 'user' }
])

// Set up error scenarios
mockDb.setMockError('projects', { message: 'Database error' })

// Use like real Supabase client
const { data, error } = await mockDb
  .from('users')
  .select('*')
  .eq('email', 'test@example.com')
  .single()
```

### MockFetch

Mocks external API calls:

```typescript
const mockFetch = new MockFetch()

// Mock specific URLs
mockFetch.setMockResponse('https://api.openai.com/v1/chat/completions', {
  status: 200,
  body: { choices: [{ message: { content: 'AI response' } }] }
})

// Mock URL patterns
mockFetch.setMockResponsePattern(/tavus\.com/, {
  status: 200,
  body: { conversation_id: 'conv-123' }
})
```

### Performance Testing

```typescript
const timer = new PerformanceTimer()
timer.start()
await someOperation()
timer.stop()

// Assert performance requirements
timer.assertDurationLessThan(1000, 'Operation should complete in under 1s')

// Load testing
const results = await runLoadTest(
  () => performOperation(),
  { concurrent: 50, duration: 10000, rampUp: 2000 }
)
```

## Performance Benchmarks

The test suite includes performance benchmarks for all critical operations:

| Operation | Threshold | Description |
|-----------|-----------|-------------|
| Auth Login | 200ms | User authentication |
| Rate Limit Check | 50ms | Rate limit validation |
| Conversation Analysis | 5s | AI-powered analysis |
| Project Plan Generation | 10s | AI plan creation |
| Kiro Build Trigger | 3s | Build initiation |
| Webhook Processing | 100ms | Event processing |
| Database Query | 100ms | Simple DB operations |

## Test Coverage

The test suite covers:

### Functional Testing
- ✅ All authentication flows
- ✅ Rate limiting rules and enforcement
- ✅ Complete pipeline workflows
- ✅ Error handling and edge cases
- ✅ Security features and validation

### Performance Testing
- ✅ Response time benchmarks
- ✅ Concurrent user scenarios (50+ users)
- ✅ High throughput testing (100+ req/s)
- ✅ Memory usage monitoring
- ✅ Stress testing and recovery

### Integration Testing
- ✅ End-to-end pipeline flows
- ✅ External API integrations
- ✅ Real-time event broadcasting
- ✅ Database consistency
- ✅ Multi-component interactions

## Continuous Integration

### GitHub Actions Example

```yaml
name: Test Pipeline
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
      
      - name: Run Tests
        run: |
          cd supabase/functions/_tests
          deno run --allow-all run-tests.ts --junit
      
      - name: Upload Test Results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: supabase/functions/_tests/test-results.xml
```

### Local Development

```bash
# Set up pre-commit hook
echo '#!/bin/sh
cd supabase/functions/_tests
deno run --allow-all run-tests.ts --filter "unit"
' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## Debugging Tests

### Verbose Output

```bash
# See detailed test execution
deno run --allow-all _tests/run-tests.ts --verbose
```

### Individual Test Debugging

```bash
# Run single test with debug info
deno test --allow-all --inspect-brk auth-middleware.test.ts
```

### Mock Debugging

```typescript
// Enable mock call logging
const mockFetch = new MockFetch()
const callLog = mockFetch.getCallLog()
console.log('API calls made:', callLog)
```

## Test Data Management

### Environment Setup

Tests automatically set up a clean environment:

```typescript
setupTestEnvironment() // Sets test env vars
mockDb.clearMockData()  // Resets database state
mockFetch.clearCallLog() // Clears API call history
```

### Test Isolation

Each test runs in isolation:
- Fresh mock database state
- Clean API call history
- Reset rate limiting state
- New performance timers

## Contributing

### Adding New Tests

1. Create test file: `new-feature.test.ts`
2. Import test utilities: `import { ... } from './test-utils.ts'`
3. Add to test runner: Update `run-tests.ts`
4. Document performance benchmarks
5. Update this README

### Test Naming Convention

```typescript
Deno.test('Component - Scenario Description', async () => {
  // Test implementation
})

// Examples:
Deno.test('Auth Middleware - Login Success', async () => {})
Deno.test('Rate Limiter - Block When Limit Exceeded', async () => {})
Deno.test('Pipeline Integration - Complete Flow Success', async () => {})
```

### Performance Test Guidelines

- Always include performance benchmarks for new features
- Use realistic test data and scenarios
- Test both normal and edge case performance
- Include memory usage monitoring where applicable
- Document performance requirements and thresholds

## Troubleshooting

### Common Issues

**Tests timing out:**
```bash
# Increase timeout for slow operations
deno test --allow-all --timeout=30000 performance.test.ts
```

**Mock data issues:**
```typescript
// Reset mocks between tests
beforeEach(() => {
  mockDb.clearMockData()
  mockFetch.clearCallLog()
})
```

**Permission errors:**
```bash
# Ensure all permissions are granted
deno test --allow-all --allow-net --allow-read --allow-write
```

### Getting Help

1. Check test output for specific error messages
2. Run with `--verbose` flag for detailed information
3. Review mock setup and test data
4. Verify environment variables are set correctly
5. Check that all dependencies are available

## Metrics and Reporting

The test suite generates comprehensive metrics:

- **Test Results:** Pass/fail counts and details
- **Performance Metrics:** Response times and throughput
- **Coverage Reports:** Code coverage analysis
- **JUnit Reports:** CI/CD compatible XML reports
- **Load Test Results:** Concurrent user performance data

All metrics are logged and can be exported for analysis and monitoring.