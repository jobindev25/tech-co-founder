#!/bin/bash

# Monitoring Setup Script for Automated Development Pipeline
# This script sets up monitoring, alerting, and health checks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create monitoring configuration
create_monitoring_config() {
    log_info "Creating monitoring configuration..."
    
    cat > "$PROJECT_ROOT/monitoring/config.json" << EOF
{
  "monitoring": {
    "enabled": true,
    "interval_seconds": 60,
    "retention_days": 30,
    "alerts": {
      "enabled": true,
      "channels": ["email", "slack", "webhook"],
      "thresholds": {
        "error_rate": 0.05,
        "response_time_ms": 5000,
        "queue_backlog": 100,
        "failed_builds": 5
      }
    }
  },
  "health_checks": {
    "enabled": true,
    "interval_seconds": 30,
    "timeout_seconds": 10,
    "endpoints": [
      "/functions/v1/system-monitor?action=health",
      "/functions/v1/analyze-conversation",
      "/functions/v1/generate-project-plan",
      "/functions/v1/trigger-kiro-build",
      "/functions/v1/kiro-webhook",
      "/functions/v1/process-queue"
    ]
  },
  "performance": {
    "enabled": true,
    "sample_rate": 0.1,
    "track_slow_queries": true,
    "slow_query_threshold_ms": 1000
  },
  "security": {
    "enabled": true,
    "track_failed_auth": true,
    "track_rate_limits": true,
    "alert_on_suspicious_activity": true
  }
}
EOF
    
    log_success "Monitoring configuration created"
}

# Create health check script
create_health_check_script() {
    log_info "Creating health check script..."
    
    mkdir -p "$PROJECT_ROOT/monitoring"
    
    cat > "$PROJECT_ROOT/monitoring/health-check.ts" << 'EOF'
#!/usr/bin/env deno run --allow-net --allow-env

// Health Check Script for Automated Development Pipeline
// Runs comprehensive health checks and reports status

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time_ms: number;
  error?: string;
  details?: any;
}

interface HealthReport {
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: HealthCheckResult[];
  summary: {
    total_checks: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const HEALTH_CHECK_ENDPOINTS = [
  { name: 'System Monitor', path: '/functions/v1/system-monitor?action=health' },
  { name: 'Conversation Analysis', path: '/functions/v1/analyze-conversation' },
  { name: 'Project Plan Generator', path: '/functions/v1/generate-project-plan' },
  { name: 'Kiro Build Trigger', path: '/functions/v1/trigger-kiro-build' },
  { name: 'Kiro Webhook', path: '/functions/v1/kiro-webhook' },
  { name: 'Queue Processor', path: '/functions/v1/process-queue' },
  { name: 'WebSocket Manager', path: '/functions/v1/websocket-manager' },
  { name: 'Broadcast Events', path: '/functions/v1/broadcast-events' },
  { name: 'Rate Limiter', path: '/functions/v1/rate-limiter?action=stats' },
  { name: 'Audit Logger', path: '/functions/v1/audit-logger?action=stats' }
];

async function checkEndpoint(endpoint: { name: string; path: string }): Promise<HealthCheckResult> {
  const startTime = performance.now();
  
  try {
    const response = await fetch(`${SUPABASE_URL}${endpoint.path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    const responseTime = performance.now() - startTime;
    
    if (response.ok) {
      const data = await response.json().catch(() => null);
      return {
        service: endpoint.name,
        status: responseTime > 5000 ? 'degraded' : 'healthy',
        response_time_ms: Math.round(responseTime),
        details: data
      };
    } else {
      return {
        service: endpoint.name,
        status: 'unhealthy',
        response_time_ms: Math.round(responseTime),
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
  } catch (error) {
    const responseTime = performance.now() - startTime;
    return {
      service: endpoint.name,
      status: 'unhealthy',
      response_time_ms: Math.round(responseTime),
      error: error.message
    };
  }
}

async function runHealthChecks(): Promise<HealthReport> {
  console.log('🏥 Running health checks...\n');
  
  const checks: HealthCheckResult[] = [];
  
  // Run all health checks concurrently
  const checkPromises = HEALTH_CHECK_ENDPOINTS.map(endpoint => checkEndpoint(endpoint));
  const results = await Promise.all(checkPromises);
  
  checks.push(...results);
  
  // Calculate summary
  const summary = {
    total_checks: checks.length,
    healthy: checks.filter(c => c.status === 'healthy').length,
    degraded: checks.filter(c => c.status === 'degraded').length,
    unhealthy: checks.filter(c => c.status === 'unhealthy').length
  };
  
  // Determine overall status
  let overall_status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (summary.unhealthy > 0) {
    overall_status = 'unhealthy';
  } else if (summary.degraded > 0) {
    overall_status = 'degraded';
  }
  
  return {
    overall_status,
    timestamp: new Date().toISOString(),
    checks,
    summary
  };
}

function printHealthReport(report: HealthReport): void {
  const statusEmoji = {
    healthy: '✅',
    degraded: '⚠️',
    unhealthy: '❌'
  };
  
  console.log(`\n📊 Health Check Report - ${report.timestamp}`);
  console.log(`Overall Status: ${statusEmoji[report.overall_status]} ${report.overall_status.toUpperCase()}\n`);
  
  console.log('Service Status:');
  console.log('─'.repeat(80));
  
  for (const check of report.checks) {
    const emoji = statusEmoji[check.status];
    const status = check.status.padEnd(10);
    const service = check.service.padEnd(25);
    const responseTime = `${check.response_time_ms}ms`.padStart(8);
    
    console.log(`${emoji} ${status} ${service} ${responseTime}`);
    
    if (check.error) {
      console.log(`   Error: ${check.error}`);
    }
  }
  
  console.log('─'.repeat(80));
  console.log(`Summary: ${report.summary.healthy} healthy, ${report.summary.degraded} degraded, ${report.summary.unhealthy} unhealthy`);
  console.log('');
}

async function sendAlert(report: HealthReport): Promise<void> {
  if (report.overall_status === 'healthy') {
    return; // No alert needed
  }
  
  const alertData = {
    severity: report.overall_status === 'unhealthy' ? 'critical' : 'warning',
    title: `Pipeline Health Check Alert - ${report.overall_status.toUpperCase()}`,
    message: `Health check failed with ${report.summary.unhealthy} unhealthy and ${report.summary.degraded} degraded services`,
    timestamp: report.timestamp,
    details: report.checks.filter(c => c.status !== 'healthy')
  };
  
  // Send to webhook if configured
  const webhookUrl = Deno.env.get('ALERT_WEBHOOK_URL');
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData)
      });
      console.log('📢 Alert sent to webhook');
    } catch (error) {
      console.error('Failed to send webhook alert:', error.message);
    }
  }
}

// Main execution
if (import.meta.main) {
  try {
    const report = await runHealthChecks();
    printHealthReport(report);
    
    // Send alert if needed
    await sendAlert(report);
    
    // Exit with appropriate code
    const exitCode = report.overall_status === 'healthy' ? 0 : 1;
    Deno.exit(exitCode);
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    Deno.exit(1);
  }
}
EOF
    
    chmod +x "$PROJECT_ROOT/monitoring/health-check.ts"
    log_success "Health check script created"
}

# Create alerting configuration
create_alerting_config() {
    log_info "Creating alerting configuration..."
    
    cat > "$PROJECT_ROOT/monitoring/alerts.json" << EOF
{
  "alert_rules": [
    {
      "name": "High Error Rate",
      "condition": "error_rate > 0.05",
      "severity": "critical",
      "description": "Error rate exceeds 5%",
      "cooldown_minutes": 15
    },
    {
      "name": "Slow Response Time",
      "condition": "avg_response_time > 5000",
      "severity": "warning",
      "description": "Average response time exceeds 5 seconds",
      "cooldown_minutes": 10
    },
    {
      "name": "Queue Backlog",
      "condition": "pending_tasks > 100",
      "severity": "warning",
      "description": "Queue has more than 100 pending tasks",
      "cooldown_minutes": 5
    },
    {
      "name": "Failed Builds",
      "condition": "failed_builds_1h > 5",
      "severity": "critical",
      "description": "More than 5 builds failed in the last hour",
      "cooldown_minutes": 30
    },
    {
      "name": "Database Connection Issues",
      "condition": "db_connection_errors > 0",
      "severity": "critical",
      "description": "Database connection errors detected",
      "cooldown_minutes": 5
    },
    {
      "name": "Security Alert",
      "condition": "security_incidents > 0",
      "severity": "critical",
      "description": "Security incidents detected",
      "cooldown_minutes": 0
    }
  ],
  "notification_channels": {
    "email": {
      "enabled": false,
      "recipients": ["admin@example.com"],
      "smtp_server": "smtp.example.com",
      "smtp_port": 587
    },
    "slack": {
      "enabled": false,
      "webhook_url": "https://hooks.slack.com/services/...",
      "channel": "#alerts"
    },
    "webhook": {
      "enabled": true,
      "url": "https://your-domain.com/alerts",
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  }
}
EOF
    
    log_success "Alerting configuration created"
}

# Create monitoring dashboard configuration
create_dashboard_config() {
    log_info "Creating dashboard configuration..."
    
    cat > "$PROJECT_ROOT/monitoring/dashboard.json" << EOF
{
  "dashboard": {
    "title": "Automated Development Pipeline",
    "refresh_interval": 30,
    "panels": [
      {
        "title": "System Health",
        "type": "status",
        "query": "system_health",
        "size": "large"
      },
      {
        "title": "Request Rate",
        "type": "line_chart",
        "query": "request_rate_5m",
        "size": "medium"
      },
      {
        "title": "Response Time",
        "type": "line_chart",
        "query": "avg_response_time_5m",
        "size": "medium"
      },
      {
        "title": "Error Rate",
        "type": "line_chart",
        "query": "error_rate_5m",
        "size": "medium"
      },
      {
        "title": "Queue Status",
        "type": "bar_chart",
        "query": "queue_status",
        "size": "medium"
      },
      {
        "title": "Active Projects",
        "type": "number",
        "query": "active_projects_count",
        "size": "small"
      },
      {
        "title": "Builds Today",
        "type": "number",
        "query": "builds_today_count",
        "size": "small"
      },
      {
        "title": "Success Rate",
        "type": "gauge",
        "query": "success_rate_24h",
        "size": "small"
      },
      {
        "title": "Recent Errors",
        "type": "table",
        "query": "recent_errors",
        "size": "large"
      }
    ]
  },
  "queries": {
    "system_health": "SELECT status FROM system_health ORDER BY timestamp DESC LIMIT 1",
    "request_rate_5m": "SELECT timestamp, count(*) FROM api_usage WHERE timestamp > NOW() - INTERVAL '5 minutes' GROUP BY timestamp",
    "avg_response_time_5m": "SELECT timestamp, AVG(response_time_ms) FROM api_usage WHERE timestamp > NOW() - INTERVAL '5 minutes' GROUP BY timestamp",
    "error_rate_5m": "SELECT timestamp, COUNT(*) FILTER (WHERE status_code >= 400) / COUNT(*)::float FROM api_usage WHERE timestamp > NOW() - INTERVAL '5 minutes' GROUP BY timestamp",
    "queue_status": "SELECT status, COUNT(*) FROM processing_queue GROUP BY status",
    "active_projects_count": "SELECT COUNT(*) FROM projects WHERE status NOT IN ('completed', 'failed', 'cancelled')",
    "builds_today_count": "SELECT COUNT(*) FROM build_events WHERE DATE(timestamp) = CURRENT_DATE",
    "success_rate_24h": "SELECT COUNT(*) FILTER (WHERE success = true) / COUNT(*)::float FROM audit_logs WHERE timestamp > NOW() - INTERVAL '24 hours'",
    "recent_errors": "SELECT timestamp, action, error_message FROM audit_logs WHERE success = false ORDER BY timestamp DESC LIMIT 10"
  }
}
EOF
    
    log_success "Dashboard configuration created"
}

# Create cron job for monitoring
setup_monitoring_cron() {
    log_info "Setting up monitoring cron jobs..."
    
    cat > "$PROJECT_ROOT/monitoring/crontab" << EOF
# Automated Development Pipeline Monitoring Cron Jobs

# Health checks every 5 minutes
*/5 * * * * cd $PROJECT_ROOT && ./monitoring/health-check.ts >> /var/log/pipeline-health.log 2>&1

# Performance metrics collection every minute
* * * * * cd $PROJECT_ROOT && deno run --allow-all monitoring/collect-metrics.ts >> /var/log/pipeline-metrics.log 2>&1

# Daily cleanup of old logs and metrics
0 2 * * * cd $PROJECT_ROOT && deno run --allow-all monitoring/cleanup.ts >> /var/log/pipeline-cleanup.log 2>&1

# Weekly system health report
0 9 * * 1 cd $PROJECT_ROOT && deno run --allow-all monitoring/weekly-report.ts >> /var/log/pipeline-reports.log 2>&1
EOF
    
    log_info "To install cron jobs, run: crontab $PROJECT_ROOT/monitoring/crontab"
    log_success "Monitoring cron jobs configured"
}

# Main setup function
main() {
    log_info "=== Setting up monitoring for Automated Development Pipeline ==="
    
    # Create monitoring directory
    mkdir -p "$PROJECT_ROOT/monitoring"
    
    # Create all monitoring components
    create_monitoring_config
    create_health_check_script
    create_alerting_config
    create_dashboard_config
    setup_monitoring_cron
    
    log_success "=== Monitoring setup completed! ==="
    
    echo
    log_info "Next steps:"
    log_info "1. Configure your environment variables in .env files"
    log_info "2. Set up notification channels in monitoring/alerts.json"
    log_info "3. Install cron jobs: crontab monitoring/crontab"
    log_info "4. Test health checks: ./monitoring/health-check.ts"
    log_info "5. Set up your monitoring dashboard using monitoring/dashboard.json"
}

# Run main function
main "$@"