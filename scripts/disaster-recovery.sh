#!/bin/bash

# Disaster Recovery Script for Automated Development Pipeline
# Restores system from backups and validates functionality

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"

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

# Show help
show_help() {
    cat << EOF
Disaster Recovery Script

Usage: $0 [options]

Options:
    --backup-date DATE     Restore from specific backup date (YYYYMMDD_HHMMSS)
    --database-only        Restore only database
    --functions-only       Restore only functions
    --config-only          Restore only configuration
    --validate-only        Only validate system without restoring
    --dry-run             Show what would be restored
    -h, --help            Show this help

Examples:
    $0 --backup-date 20240115_120000
    $0 --database-only --backup-date 20240115_120000
    $0 --validate-only

EOF
}

# Restore database
restore_database() {
    local backup_date="$1"
    local backup_file="$BACKUP_DIR/database_backup_${backup_date}.sql.gz"
    
    if [ ! -f "$backup_file" ]; then
        log_error "Database backup not found: $backup_file"
        return 1
    fi
    
    log_info "Restoring database from $backup_file..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "DRY RUN: Would restore database from $backup_file"
        return 0
    fi
    
    # Create a backup of current state before restore
    log_info "Creating pre-restore backup..."
    pg_dump "$DATABASE_URL" > "$BACKUP_DIR/pre_restore_$(date +%Y%m%d_%H%M%S).sql"
    
    # Restore database
    gunzip -c "$backup_file" | psql "$DATABASE_URL"
    
    log_success "Database restored successfully"
}

# Restore functions
restore_functions() {
    local backup_date="$1"
    local backup_file="$BACKUP_DIR/functions_backup_${backup_date}.tar.gz"
    
    if [ ! -f "$backup_file" ]; then
        log_error "Functions backup not found: $backup_file"
        return 1
    fi
    
    log_info "Restoring functions from $backup_file..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "DRY RUN: Would restore functions from $backup_file"
        return 0
    fi
    
    # Backup current functions
    if [ -d "$PROJECT_ROOT/supabase/functions" ]; then
        mv "$PROJECT_ROOT/supabase/functions" "$PROJECT_ROOT/supabase/functions.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Extract functions
    tar -xzf "$backup_file" -C "$PROJECT_ROOT"
    
    # Deploy functions
    cd "$PROJECT_ROOT/supabase"
    supabase functions deploy
    
    log_success "Functions restored and deployed successfully"
}

# Validate system
validate_system() {
    log_info "Validating system functionality..."
    
    # Run health checks
    if ! "$PROJECT_ROOT/monitoring/health-check.ts"; then
        log_error "Health checks failed"
        return 1
    fi
    
    # Run basic functionality tests
    cd "$PROJECT_ROOT/supabase"
    if ! deno test --allow-all functions/_tests/basic-functionality.test.ts; then
        log_error "Basic functionality tests failed"
        return 1
    fi
    
    log_success "System validation passed"
}

# Main recovery function
main() {
    local backup_date=""
    local database_only=false
    local functions_only=false
    local config_only=false
    local validate_only=false
    DRY_RUN=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backup-date)
                backup_date="$2"
                shift 2
                ;;
            --database-only)
                database_only=true
                shift
                ;;
            --functions-only)
                functions_only=true
                shift
                ;;
            --config-only)
                config_only=true
                shift
                ;;
            --validate-only)
                validate_only=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
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
    
    if [ "$validate_only" = true ]; then
        validate_system
        exit $?
    fi
    
    if [ -z "$backup_date" ]; then
        log_error "Backup date is required (use --backup-date)"
        show_help
        exit 1
    fi
    
    log_info "=== Starting Disaster Recovery ==="
    log_info "Backup Date: $backup_date"
    log_info "Dry Run: $DRY_RUN"
    
    if [ "$database_only" = true ]; then
        restore_database "$backup_date"
    elif [ "$functions_only" = true ]; then
        restore_functions "$backup_date"
    else
        # Full restore
        restore_database "$backup_date"
        restore_functions "$backup_date"
    fi
    
    # Validate after restore
    if [ "$DRY_RUN" != true ]; then
        validate_system
    fi
    
    log_success "=== Disaster Recovery completed successfully! ==="
}

main "$@"