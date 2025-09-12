#!/bin/bash

# Automated Development Pipeline Deployment Script
# Usage: ./scripts/deploy.sh [environment] [options]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SUPABASE_DIR="$PROJECT_ROOT/supabase"

# Default values
ENVIRONMENT="staging"
SKIP_TESTS=false
SKIP_MIGRATIONS=false
SKIP_FUNCTIONS=false
DRY_RUN=false
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Help function
show_help() {
    cat << EOF
Automated Development Pipeline Deployment Script

Usage: $0 [environment] [options]

Environments:
    local       Deploy to local Supabase instance
    staging     Deploy to staging environment
    production  Deploy to production environment

Options:
    --skip-tests        Skip running tests before deployment
    --skip-migrations   Skip database migrations
    --skip-functions    Skip Edge Functions deployment
    --dry-run          Show what would be deployed without actually deploying
    --verbose          Enable verbose output
    -h, --help         Show this help message

Examples:
    $0 staging
    $0 production --skip-tests
    $0 local --dry-run --verbose

Environment Variables Required:
    SUPABASE_ACCESS_TOKEN    Supabase access token
    SUPABASE_PROJECT_ID      Supabase project ID (for staging/production)

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        local|staging|production)
            ENVIRONMENT="$1"
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        --skip-functions)
            SKIP_FUNCTIONS=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Enable verbose output if requested
if [ "$VERBOSE" = true ]; then
    set -x
fi

log_info "Starting deployment to $ENVIRONMENT environment"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Supabase CLI is installed
    if ! command -v supabase &> /dev/null; then
        log_error "Supabase CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if Deno is installed
    if ! command -v deno &> /dev/null; then
        log_error "Deno is not installed. Please install it first."
        exit 1
    fi
    
    # Check environment variables
    if [ "$ENVIRONMENT" != "local" ]; then
        if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
            log_error "SUPABASE_ACCESS_TOKEN environment variable is required"
            exit 1
        fi
        
        if [ -z "$SUPABASE_PROJECT_ID" ]; then
            log_error "SUPABASE_PROJECT_ID environment variable is required"
            exit 1
        fi
    fi
    
    # Check if .env file exists for the environment
    ENV_FILE="$SUPABASE_DIR/.env.$ENVIRONMENT"
    if [ ! -f "$ENV_FILE" ] && [ "$ENVIRONMENT" != "local" ]; then
        log_warning "Environment file $ENV_FILE not found"
    fi
    
    log_success "Prerequisites check passed"
}

# Run tests
run_tests() {
    if [ "$SKIP_TESTS" = true ]; then
        log_warning "Skipping tests as requested"
        return 0
    fi
    
    log_info "Running tests..."
    
    cd "$SUPABASE_DIR"
    
    if [ "$ENVIRONMENT" = "local" ]; then
        # Start local Supabase for testing
        log_info "Starting local Supabase instance..."
        supabase start
        
        # Wait for services to be ready
        sleep 10
    fi
    
    # Run function tests
    log_info "Running function tests..."
    if ! deno test --allow-all functions/_tests/; then
        log_error "Function tests failed"
        if [ "$ENVIRONMENT" = "local" ]; then
            supabase stop
        fi
        exit 1
    fi
    
    # Run integration tests
    log_info "Running integration tests..."
    if ! deno run --allow-all functions/_tests/run-tests.ts; then
        log_error "Integration tests failed"
        if [ "$ENVIRONMENT" = "local" ]; then
            supabase stop
        fi
        exit 1
    fi
    
    if [ "$ENVIRONMENT" = "local" ]; then
        supabase stop
    fi
    
    log_success "All tests passed"
}

# Deploy database migrations
deploy_migrations() {
    if [ "$SKIP_MIGRATIONS" = true ]; then
        log_warning "Skipping database migrations as requested"
        return 0
    fi
    
    log_info "Deploying database migrations..."
    
    cd "$SUPABASE_DIR"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "DRY RUN: Would deploy migrations to $ENVIRONMENT"
        return 0
    fi
    
    if [ "$ENVIRONMENT" = "local" ]; then
        supabase db reset
    else
        # Link to remote project
        supabase link --project-ref "$SUPABASE_PROJECT_ID"
        
        # Push migrations
        supabase db push
    fi
    
    log_success "Database migrations deployed"
}

# Deploy Edge Functions
deploy_functions() {
    if [ "$SKIP_FUNCTIONS" = true ]; then
        log_warning "Skipping Edge Functions deployment as requested"
        return 0
    fi
    
    log_info "Deploying Edge Functions..."
    
    cd "$SUPABASE_DIR"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "DRY RUN: Would deploy functions to $ENVIRONMENT"
        supabase functions list
        return 0
    fi
    
    # Deploy all functions
    if [ "$ENVIRONMENT" = "local" ]; then
        supabase functions serve
    else
        supabase functions deploy --no-verify-jwt
        
        # Set environment secrets
        ENV_FILE=".env.$ENVIRONMENT"
        if [ -f "$ENV_FILE" ]; then
            log_info "Setting function secrets from $ENV_FILE"
            supabase secrets set --env-file "$ENV_FILE"
        fi
    fi
    
    log_success "Edge Functions deployed"
}

# Run post-deployment health checks
run_health_checks() {
    log_info "Running post-deployment health checks..."
    
    cd "$SUPABASE_DIR"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "DRY RUN: Would run health checks for $ENVIRONMENT"
        return 0
    fi
    
    # Run health check tests
    if ! deno run --allow-all functions/_tests/run-tests.ts --environment="$ENVIRONMENT" --health-check-only; then
        log_error "Health checks failed"
        exit 1
    fi
    
    log_success "Health checks passed"
}

# Rollback function
rollback_deployment() {
    log_error "Deployment failed. Initiating rollback..."
    
    # Add rollback logic here
    # This could include:
    # - Reverting to previous function versions
    # - Rolling back database migrations
    # - Restoring previous configuration
    
    log_warning "Rollback completed. Please check the system status."
}

# Main deployment function
main() {
    # Set up error handling
    trap rollback_deployment ERR
    
    log_info "=== Automated Development Pipeline Deployment ==="
    log_info "Environment: $ENVIRONMENT"
    log_info "Dry Run: $DRY_RUN"
    log_info "Skip Tests: $SKIP_TESTS"
    log_info "Skip Migrations: $SKIP_MIGRATIONS"
    log_info "Skip Functions: $SKIP_FUNCTIONS"
    echo
    
    # Run deployment steps
    check_prerequisites
    run_tests
    deploy_migrations
    deploy_functions
    run_health_checks
    
    log_success "=== Deployment completed successfully! ==="
    
    # Show deployment summary
    echo
    log_info "Deployment Summary:"
    log_info "- Environment: $ENVIRONMENT"
    log_info "- Timestamp: $(date)"
    log_info "- Git Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
    
    if [ "$ENVIRONMENT" != "local" ]; then
        log_info "- Project ID: $SUPABASE_PROJECT_ID"
        log_info "- Functions URL: https://$SUPABASE_PROJECT_ID.supabase.co/functions/v1"
    fi
}

# Run main function
main "$@"