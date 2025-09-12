#!/bin/bash

# Production Readiness Check Script
# Validates that the system is ready for production deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNING_CHECKS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_CHECKS++))
}

check_item() {
    ((TOTAL_CHECKS++))
    echo -n "Checking $1... "
}

# Environment checks
check_environment() {
    log_info "=== Environment Configuration ==="
    
    check_item "Supabase URL configuration"
    if [ -n "$SUPABASE_URL" ] && [[ "$SUPABASE_URL" == https://* ]]; then
        log_success "Supabase URL properly configured"
    else
        log_error "Supabase URL not configured or not HTTPS"
    fi
    
    check_item "Service role key"
    if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ] && [ ${#SUPABASE_SERVICE_ROLE_KEY} -gt 50 ]; then
        log_success "Service role key configured"
    else
        log_error "Service role key missing or too short"
    fi
    
    check_item "AI API keys"
    if [ -n "$OPENAI_API_KEY" ] || [ -n "$CLAUDE_API_KEY" ]; then
        log_success "AI API keys configured"
    else
        log_error "No AI API keys configured"
    fi
    
    check_item "External API keys"
    if [ -n "$TAVUS_API_KEY" ] && [ -n "$KIRO_API_KEY" ]; then
        log_success "External API keys configured"
    else
        log_error "Missing external API keys (Tavus/Kiro)"
    fi
    
    check_item "Security configuration"
    if [ -n "$JWT_SECRET" ] && [ ${#JWT_SECRET} -gt 32 ]; then
        log_success "JWT secret properly configured"
    else
        log_error "JWT secret missing or too short"
    fi
}

# Database checks
check_database() {
    log_info "=== Database Configuration ==="
    
    check_item "Database connectivity"
    if supabase db shell -c "SELECT 1;" >/dev/null 2>&1; then
        log_success "Database connection successful"
    else
        log_error "Cannot connect to database"
        return
    fi
    
    check_item "Required tables exist"
    local required_tables=("projects" "conversations" "build_events" "processing_queue" "api_usage")
    local missing_tables=()
    
    for table in "${required_tables[@]}"; do
        if ! supabase db shell -c "SELECT 1 FROM $table LIMIT 1;" >/dev/null 2>&1; then
            missing_tables+=("$table")
        fi
    done
    
    if [ ${#missing_tables[@]} -eq 0 ]; then
        log_success "All required tables exist"
    else
        log_error "Missing tables: ${missing_tables[*]}"
    fi
    
    check_item "Database indexes"
    local index_count=$(supabase db shell -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" -t)
    if [ "$index_count" -gt 10 ]; then
        log_success "Database indexes configured ($index_count indexes)"
    else
        log_warning "Few database indexes found ($index_count)"
    fi
    
    check_item "RLS policies"
    local rls_count=$(supabase db shell -c "SELECT COUNT(*) FROM pg_policies;" -t)
    if [ "$rls_count" -gt 5 ]; then
        log_success "RLS policies configured ($rls_count policies)"
    else
        log_warning "Few RLS policies found ($rls_count)"
    fi
}

# Function checks
check_functions() {
    log_info "=== Edge Functions ==="
    
    local functions_dir="$PROJECT_ROOT/supabase/functions"
    local required_functions=("analyze-conversation" "generate-project-plan" "trigger-kiro-build" "kiro-webhook" "tavus-webhook")
    
    for func in "${required_functions[@]}"; do
        check_item "Function: $func"
        if [ -f "$functions_dir/$func/index.ts" ]; then
            log_success "Function $func exists"
        else
            log_error "Function $func missing"
        fi
    done
    
    check_item "Function deployment"
    if supabase functions list >/dev/null 2>&1; then
        local deployed_count=$(supabase functions list | grep -c "│" || echo "0")
        if [ "$deployed_count" -gt 5 ]; then
            log_success "Functions deployed ($deployed_count functions)"
        else
            log_warning "Few functions deployed ($deployed_count)"
        fi
    else
        log_error "Cannot list deployed functions"
    fi
}

# Security checks
check_security() {
    log_info "=== Security Configuration ==="
    
    check_item "Webhook signature validation"
    if [ -n "$TAVUS_WEBHOOK_SECRET" ] && [ -n "$KIRO_WEBHOOK_SECRET" ]; then
        log_success "Webhook secrets configured"
    else
        log_error "Webhook secrets missing"
    fi
    
    check_item "Rate limiting configuration"
    if [ "$RATE_LIMIT_ENABLED" = "true" ]; then
        log_success "Rate limiting enabled"
    else
        log_warning "Rate limiting disabled"
    fi
    
    check_item "Admin token security"
    if [ -n "$ADMIN_TOKEN" ] && [ ${#ADMIN_TOKEN} -gt 20 ]; then
        log_success "Admin token configured"
    else
        log_error "Admin token missing or too short"
    fi
    
    check_item "HTTPS enforcement"
    if [[ "$SUPABASE_URL" == https://* ]]; then
        log_success "HTTPS enforced"
    else
        log_error "HTTPS not enforced"
    fi
}

# Performance checks
check_performance() {
    log_info "=== Performance Configuration ==="
    
    check_item "Connection pooling"
    local pool_size=${DB_POOL_SIZE:-10}
    if [ "$pool_size" -ge 10 ]; then
        log_success "Connection pooling configured (size: $pool_size)"
    else
        log_warning "Small connection pool size: $pool_size"
    fi
    
    check_item "Timeout configuration"
    local timeout=${DB_QUERY_TIMEOUT:-60000}
    if [ "$timeout" -le 60000 ] && [ "$timeout" -ge 5000 ]; then
        log_success "Query timeout configured: ${timeout}ms"
    else
        log_warning "Query timeout may be suboptimal: ${timeout}ms"
    fi
    
    check_item "Caching configuration"
    if [ -n "$CACHE_TTL" ] && [ "$CACHE_TTL" -gt 0 ]; then
        log_success "Caching configured (TTL: ${CACHE_TTL}s)"
    else
        log_warning "Caching not configured"
    fi
}

# Monitoring checks
check_monitoring() {
    log_info "=== Monitoring Configuration ==="
    
    check_item "Health check endpoint"
    if curl -s "$SUPABASE_URL/functions/v1/system-monitor?action=health" >/dev/null 2>&1; then
        log_success "Health check endpoint accessible"
    else
        log_error "Health check endpoint not accessible"
    fi
    
    check_item "Logging configuration"
    if [ "$LOG_LEVEL" = "INFO" ] || [ "$LOG_LEVEL" = "WARN" ] || [ "$LOG_LEVEL" = "ERROR" ]; then
        log_success "Production log level configured: $LOG_LEVEL"
    else
        log_warning "Log level may be too verbose: $LOG_LEVEL"
    fi
    
    check_item "Error tracking"
    if [ "$ERROR_TRACKING" = "true" ]; then
        log_success "Error tracking enabled"
    else
        log_warning "Error tracking disabled"
    fi
    
    check_item "Performance monitoring"
    if [ "$PERFORMANCE_MONITORING" = "true" ]; then
        log_success "Performance monitoring enabled"
    else
        log_warning "Performance monitoring disabled"
    fi
}

# Backup checks
check_backups() {
    log_info "=== Backup Configuration ==="
    
    check_item "Backup scripts"
    if [ -f "$PROJECT_ROOT/scripts/backup-system.sh" ]; then
        log_success "Backup scripts available"
    else
        log_error "Backup scripts missing"
    fi
    
    check_item "Disaster recovery plan"
    if [ -f "$PROJECT_ROOT/docs/disaster-recovery-plan.md" ]; then
        log_success "Disaster recovery plan documented"
    else
        log_error "Disaster recovery plan missing"
    fi
    
    check_item "Backup directory"
    local backup_dir="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
    if [ -d "$backup_dir" ]; then
        log_success "Backup directory exists: $backup_dir"
    else
        log_warning "Backup directory not found: $backup_dir"
    fi
}

# Documentation checks
check_documentation() {
    log_info "=== Documentation ==="
    
    local docs=("api-documentation.md" "developer-guide.md" "troubleshooting-guide.md" "production-readiness-checklist.md")
    
    for doc in "${docs[@]}"; do
        check_item "Documentation: $doc"
        if [ -f "$PROJECT_ROOT/docs/$doc" ]; then
            log_success "Documentation exists: $doc"
        else
            log_error "Documentation missing: $doc"
        fi
    done
    
    check_item "README file"
    if [ -f "$PROJECT_ROOT/README.md" ]; then
        log_success "README file exists"
    else
        log_warning "README file missing"
    fi
}

# Test checks
check_tests() {
    log_info "=== Test Coverage ==="
    
    check_item "Test files exist"
    local test_count=$(find "$PROJECT_ROOT/supabase/functions/_tests" -name "*.test.ts" | wc -l)
    if [ "$test_count" -gt 5 ]; then
        log_success "Test files found ($test_count tests)"
    else
        log_warning "Few test files found ($test_count)"
    fi
    
    check_item "End-to-end tests"
    if [ -f "$PROJECT_ROOT/supabase/functions/_tests/end-to-end.test.ts" ]; then
        log_success "End-to-end tests available"
    else
        log_error "End-to-end tests missing"
    fi
    
    check_item "Test runner"
    if [ -f "$PROJECT_ROOT/supabase/functions/_tests/run-tests.ts" ]; then
        log_success "Test runner available"
    else
        log_error "Test runner missing"
    fi
}

# Run all checks
main() {
    log_info "🔍 Production Readiness Check - Automated Development Pipeline"
    log_info "Starting comprehensive system validation..."
    echo
    
    check_environment
    echo
    check_database
    echo
    check_functions
    echo
    check_security
    echo
    check_performance
    echo
    check_monitoring
    echo
    check_backups
    echo
    check_documentation
    echo
    check_tests
    echo
    
    # Summary
    log_info "=== SUMMARY ==="
    echo "Total Checks: $TOTAL_CHECKS"
    echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "Warnings: ${YELLOW}$WARNING_CHECKS${NC}"
    echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
    echo
    
    # Determine overall status
    if [ "$FAILED_CHECKS" -eq 0 ]; then
        if [ "$WARNING_CHECKS" -eq 0 ]; then
            log_success "🎉 SYSTEM IS PRODUCTION READY!"
            echo "All checks passed. The system is ready for production deployment."
        else
            log_warning "⚠️  SYSTEM IS MOSTLY READY"
            echo "System is ready for production but has $WARNING_CHECKS warnings to address."
        fi
        exit 0
    else
        log_error "❌ SYSTEM IS NOT PRODUCTION READY"
        echo "System has $FAILED_CHECKS critical issues that must be resolved before production deployment."
        exit 1
    fi
}

main "$@"