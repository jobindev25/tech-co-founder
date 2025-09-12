# Troubleshooting Guide - Automated Development Pipeline

This guide helps diagnose and resolve common issues with the Automated Development Pipeline system.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Issues](#common-issues)
3. [Function-Specific Issues](#function-specific-issues)
4. [Database Issues](#database-issues)
5. [Integration Issues](#integration-issues)
6. [Performance Issues](#performance-issues)
7. [Security Issues](#security-issues)
8. [Monitoring and Alerts](#monitoring-and-alerts)
9. [Recovery Procedures](#recovery-procedures)

## Quick Diagnostics

### System Health Check

Run the health check script to get an overview of system status:

```bash
# Local environment
./monitoring/health-check.ts

# Production environment
curl "https://your-project.supabase.co/functions/v1/system-monitor?action=health" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### Check Function Logs

```bash
# Local logs
supabase functions logs --follow

# Production logs
supabase functions logs --project-ref your-project-id --follow
```

### Database Connection Test

```bash
# Test database connectivity
supabase db shell
\dt  # List tables
SELECT COUNT(*) FROM projects;  # Test query
```

## Common Issues

### 1. Function Timeout Errors

**Symptoms:**
- Functions returning 504 Gateway Timeout
- Long-running operations failing
- AI analysis taking too long

**Diagnosis:**
```bash
# Check function logs for timeout errors
supabase functions logs | grep -i timeout

# Check performance metrics
curl "https://your-project.supabase.co/functions/v1/system-monitor?action=performance&timeframe=1h"
```

**Solutions:**

1. **Increase function timeout** (if possible):
   ```typescript
   // Add timeout wrapper
   import { timeout } from '../_shared/utils.ts'
   
   const result = await timeout(
     longRunningOperation(),
     60000 // 60 seconds
   )
   ```

2. **Break down large operations**:
   ```typescript
   // Process in smaller chunks
   const chunks = chunkArray(largeDataset, 100)
   for (const chunk of chunks) {
     await processChunk(chunk)
     await delay(100) // Small delay between chunks
   }
   ```

3. **Use queue for long operations**:
   ```typescript
   // Queue long-running task instead of processing synchronously
   await db.queue.queueTask('long_running_analysis', {
     conversation_id: conversationId,
     transcript_url: transcriptUrl
   }, 5)
   ```

### 2. Rate Limit Exceeded

**Symptoms:**
- 429 Too Many Requests responses
- API calls being rejected
- Users unable to perform actions

**Diagnosis:**
```bash
# Check rate limit status
curl "https://your-project.supabase.co/functions/v1/rate-limiter?action=stats&timeframe=1h"

# Check specific user rate limits
curl -X POST "https://your-project.supabase.co/functions/v1/rate-limiter?action=status" \
  -d '{"identifier": "user_123"}'
```

**Solutions:**

1. **Increase rate limits** (if appropriate):
   ```typescript
   // Update rate limit rules in rate-limiter/index.ts
   const RATE_LIMIT_RULES = {
     'api_general': { requests: 200, window: 60, blockDuration: 300 }
   }
   ```

2. **Implement exponential backoff** in clients:
   ```javascript
   async function apiCallWithRetry(url, options, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         const response = await fetch(url, options)
         if (response.status === 429) {
           const retryAfter = response.headers.get('Retry-After') || Math.pow(2, i)
           await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
           continue
         }
         return response
       } catch (error) {
         if (i === maxRetries - 1) throw error
       }
     }
   }
   ```

3. **Reset rate limits** (admin only):
   ```bash
   curl -X POST "https://your-project.supabase.co/functions/v1/rate-limiter?action=reset" \
     -d '{"identifier": "user_123", "admin_token": "$ADMIN_TOKEN"}'
   ```

### 3. Authentication Failures

**Symptoms:**
- 401 Unauthorized responses
- JWT token validation errors
- API key authentication failing

**Diagnosis:**
```bash
# Test token validation
curl "https://your-project.supabase.co/functions/v1/auth-middleware?action=verify" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Check audit logs for auth failures
curl "https://your-project.supabase.co/functions/v1/audit-logger?action=query" \
  -d '{"action": "login", "success": false, "limit": 10}'
```

**Solutions:**

1. **Refresh expired tokens**:
   ```javascript
   // Check if token is expired and refresh
   if (isTokenExpired(accessToken)) {
     const newToken = await refreshToken(refreshToken)
     // Update stored token
   }
   ```

2. **Verify JWT secret**:
   ```bash
   # Ensure JWT_SECRET environment variable is set correctly
   supabase secrets list
   ```

3. **Check API key validity**:
   ```sql
   -- Check API key status in database
   SELECT * FROM api_keys WHERE key_hash = 'hashed_key' AND active = true;
   ```

### 4. Database Connection Issues

**Symptoms:**
- Database connection errors
- Slow query performance
- Connection pool exhaustion

**Diagnosis:**
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Solutions:**

1. **Optimize slow queries**:
   ```sql
   -- Add missing indexes
   CREATE INDEX CONCURRENTLY idx_projects_status_created 
   ON projects(status, created_at);
   
   -- Analyze query performance
   EXPLAIN ANALYZE SELECT * FROM projects WHERE status = 'building';
   ```

2. **Connection pooling**:
   ```typescript
   // Use connection pooling in database service
   const supabase = createClient(url, key, {
     db: {
       schema: 'public',
       poolSize: 10
     }
   })
   ```

## Function-Specific Issues

### Conversation Analysis Function

**Issue: AI Analysis Failing**

```bash
# Check AI service logs
supabase functions logs | grep "AIAnalysisError"

# Test AI service directly
curl -X POST "https://your-project.supabase.co/functions/v1/analyze-conversation" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"conversation_id": "test", "transcript_url": "https://example.com/transcript"}'
```

**Solutions:**
1. Check OpenAI API key validity
2. Verify transcript URL accessibility
3. Check AI service rate limits
4. Validate transcript format

**Issue: Transcript Retrieval Failing**

```typescript
// Add better error handling for transcript retrieval
async function retrieveTranscript(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('TAVUS_API_KEY')}`,
        'User-Agent': 'Pipeline/1.0'
      },
      signal: AbortSignal.timeout(30000)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      throw new Error(`Unexpected content type: ${contentType}`)
    }
    
    return await response.text()
  } catch (error) {
    logger.error('Transcript retrieval failed', error, { url })
    throw new AIAnalysisError(`Failed to retrieve transcript: ${error.message}`)
  }
}
```

### Kiro Integration Function

**Issue: Build Trigger Failing**

```bash
# Check Kiro API connectivity
curl -X GET "https://api.kiro.dev/health" \
  -H "Authorization: Bearer $KIRO_API_KEY"

# Check build trigger logs
supabase functions logs | grep "trigger-kiro-build"
```

**Solutions:**
1. Verify Kiro API key
2. Check project plan format
3. Validate webhook URL configuration
4. Test Kiro API endpoints

**Issue: Webhook Not Received**

```bash
# Check webhook configuration
curl "https://your-project.supabase.co/functions/v1/kiro-webhook" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"build_id": "test", "event_type": "build.started"}'
```

**Solutions:**
1. Verify webhook URL in Kiro configuration
2. Check webhook signature validation
3. Ensure webhook endpoint is accessible
4. Validate webhook payload format

### Queue Processing Issues

**Issue: Tasks Not Processing**

```bash
# Check queue status
curl "https://your-project.supabase.co/functions/v1/system-monitor?action=metrics" | jq '.queue'

# Check pending tasks
psql -c "SELECT task_type, status, COUNT(*) FROM processing_queue GROUP BY task_type, status;"
```

**Solutions:**
1. Restart queue processor
2. Check for stuck tasks
3. Increase concurrent processing limit
4. Clear failed tasks

```sql
-- Clear old failed tasks
DELETE FROM processing_queue 
WHERE status = 'failed' 
AND created_at < NOW() - INTERVAL '24 hours';

-- Reset stuck processing tasks
UPDATE processing_queue 
SET status = 'pending', started_at = NULL 
WHERE status = 'processing' 
AND started_at < NOW() - INTERVAL '1 hour';
```

## Database Issues

### Migration Failures

**Issue: Migration Not Applying**

```bash
# Check migration status
supabase migration list

# Apply specific migration
supabase migration up --target 20240115000000

# Rollback migration
supabase migration down --target 20240114000000
```

**Solutions:**
1. Check migration syntax
2. Resolve dependency conflicts
3. Apply migrations in correct order
4. Handle data conflicts

### Performance Issues

**Issue: Slow Queries**

```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s

-- Find slow queries
SELECT query, mean_exec_time, calls, total_exec_time
FROM pg_stat_statements 
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC;

-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
AND n_distinct > 100
AND correlation < 0.1;
```

**Solutions:**
1. Add appropriate indexes
2. Optimize query structure
3. Use query caching
4. Partition large tables

### Data Integrity Issues

**Issue: Orphaned Records**

```sql
-- Find orphaned build events
SELECT be.id, be.project_id 
FROM build_events be 
LEFT JOIN projects p ON be.project_id = p.id 
WHERE p.id IS NULL;

-- Find projects without conversations
SELECT p.id, p.conversation_id 
FROM projects p 
LEFT JOIN conversations c ON p.conversation_id = c.conversation_id 
WHERE c.conversation_id IS NULL;
```

**Solutions:**
1. Clean up orphaned records
2. Add foreign key constraints
3. Implement cascade deletes
4. Regular data validation

## Integration Issues

### Tavus Integration

**Issue: Webhook Not Triggering Pipeline**

```bash
# Check Tavus webhook logs
supabase functions logs | grep "tavus-webhook"

# Test webhook manually
curl -X POST "https://your-project.supabase.co/functions/v1/tavus-webhook" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "conversation_ended", "conversation_id": "test_123"}'
```

**Solutions:**
1. Verify webhook URL in Tavus dashboard
2. Check webhook signature validation
3. Ensure conversation_ended events are configured
4. Validate payload format

### Kiro Integration

**Issue: Build Status Not Updating**

```bash
# Check Kiro webhook logs
supabase functions logs | grep "kiro-webhook"

# Verify project mapping
psql -c "SELECT id, kiro_build_id, kiro_project_id, status FROM projects WHERE kiro_build_id IS NOT NULL;"
```

**Solutions:**
1. Verify webhook configuration in Kiro
2. Check build ID mapping
3. Ensure webhook events are enabled
4. Validate webhook signature

## Performance Issues

### High Response Times

**Diagnosis:**
```bash
# Check API performance metrics
curl "https://your-project.supabase.co/functions/v1/system-monitor?action=performance&timeframe=1h"

# Monitor real-time performance
watch -n 5 'curl -s "https://your-project.supabase.co/functions/v1/system-monitor?action=health" | jq ".api.avg_response_time"'
```

**Solutions:**

1. **Optimize database queries**:
   ```sql
   -- Add composite indexes for common query patterns
   CREATE INDEX CONCURRENTLY idx_projects_status_priority_created 
   ON projects(status, priority, created_at);
   ```

2. **Implement caching**:
   ```typescript
   // Add response caching
   const cacheKey = `project_${projectId}`
   let project = await cache.get(cacheKey)
   
   if (!project) {
     project = await db.projects.getProject(projectId)
     await cache.set(cacheKey, project, 300) // 5 minutes
   }
   ```

3. **Use connection pooling**:
   ```typescript
   // Configure connection pooling
   const supabase = createClient(url, key, {
     db: { poolSize: 20 }
   })
   ```

### Memory Issues

**Diagnosis:**
```bash
# Monitor memory usage
deno run --allow-all --v8-flags=--expose-gc memory-monitor.ts

# Check for memory leaks
supabase functions logs | grep -i "memory\|heap"
```

**Solutions:**

1. **Clean up large objects**:
   ```typescript
   import { cleanupLargeObjects } from '../_shared/utils.ts'
   
   try {
     const largeData = await processLargeDataset()
     // Process data
   } finally {
     cleanupLargeObjects(largeData)
   }
   ```

2. **Stream large responses**:
   ```typescript
   // Stream large datasets instead of loading into memory
   const stream = new ReadableStream({
     start(controller) {
       // Stream data chunks
     }
   })
   
   return new Response(stream)
   ```

## Security Issues

### Suspicious Activity Detection

**Issue: Multiple Failed Login Attempts**

```bash
# Check security alerts
curl "https://your-project.supabase.co/functions/v1/audit-logger?action=query" \
  -d '{"action": "login", "success": false, "limit": 50}'

# Check IP-based attacks
psql -c "SELECT ip_address, COUNT(*) FROM audit_logs WHERE action = 'login' AND success = false AND created_at > NOW() - INTERVAL '1 hour' GROUP BY ip_address ORDER BY count DESC;"
```

**Solutions:**
1. Block suspicious IP addresses
2. Implement account lockout
3. Add CAPTCHA for repeated failures
4. Enable two-factor authentication

### Data Breach Response

**Issue: Unauthorized Data Access**

```bash
# Check audit logs for suspicious access
curl "https://your-project.supabase.co/functions/v1/audit-logger?action=query" \
  -d '{"resource_type": "project", "action": "data_export", "limit": 100}'

# Generate security report
curl "https://your-project.supabase.co/functions/v1/audit-logger?action=compliance" \
  -d '{"report_type": "security_incident", "admin_token": "$ADMIN_TOKEN"}'
```

**Response Steps:**
1. Identify affected data
2. Revoke compromised credentials
3. Notify affected users
4. Implement additional security measures
5. Document incident for compliance

## Monitoring and Alerts

### Setting Up Alerts

**Configure Webhook Alerts:**
```json
{
  "webhook_url": "https://your-alerting-system.com/webhook",
  "alert_rules": [
    {
      "name": "High Error Rate",
      "condition": "error_rate > 0.05",
      "severity": "critical"
    },
    {
      "name": "Queue Backlog",
      "condition": "pending_tasks > 100",
      "severity": "warning"
    }
  ]
}
```

**Monitor Key Metrics:**
```bash
# Set up monitoring cron job
*/5 * * * * curl -s "https://your-project.supabase.co/functions/v1/system-monitor?action=health" | jq -r '.status' | grep -v "healthy" && echo "ALERT: System unhealthy"
```

### Dashboard Setup

**Create monitoring dashboard** using the configuration in `monitoring/dashboard.json`:

1. Set up Grafana or similar tool
2. Configure data sources (Supabase)
3. Import dashboard configuration
4. Set up alert rules

## Recovery Procedures

### Database Recovery

**Backup and Restore:**
```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql $DATABASE_URL < backup_20240115_120000.sql
```

**Point-in-Time Recovery:**
```bash
# Restore to specific timestamp
supabase db restore --timestamp "2024-01-15 12:00:00"
```

### Function Recovery

**Rollback Deployment:**
```bash
# Deploy previous version
git checkout previous-working-commit
./scripts/deploy.sh production

# Or rollback specific function
supabase functions deploy function-name --project-ref $PROJECT_ID
```

### Data Recovery

**Recover Deleted Records:**
```sql
-- If using soft deletes
UPDATE projects SET deleted_at = NULL WHERE id = 123;

-- Restore from audit logs
INSERT INTO projects (...)
SELECT ... FROM audit_logs 
WHERE resource_type = 'project' 
AND resource_id = '123' 
AND action = 'created';
```

### Emergency Contacts

**Escalation Procedure:**
1. **Level 1**: Development Team
2. **Level 2**: Technical Lead
3. **Level 3**: System Administrator
4. **Level 4**: External Support

**Contact Information:**
- Development Team: dev-team@company.com
- Technical Lead: tech-lead@company.com
- System Admin: sysadmin@company.com
- Emergency Hotline: +1-555-EMERGENCY

---

## Getting Help

If you can't resolve an issue using this guide:

1. **Check the logs** for detailed error messages
2. **Search the documentation** for similar issues
3. **Contact the development team** with:
   - Detailed error description
   - Steps to reproduce
   - Relevant log entries
   - System configuration details

4. **Create an incident report** for critical issues
5. **Update this guide** once the issue is resolved

For urgent issues, use the emergency escalation procedure above.