#!/bin/bash

# Automated Development Pipeline Backup System
# Creates comprehensive backups of database, configuration, and functions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

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

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database backup
backup_database() {
    log_info "Creating database backup..."
    
    local backup_file="$BACKUP_DIR/database_backup_$TIMESTAMP.sql"
    
    if [ -n "$DATABASE_URL" ]; then
        pg_dump "$DATABASE_URL" > "$backup_file"
        gzip "$backup_file"
        log_success "Database backup created: ${backup_file}.gz"
    else
        log_error "DATABASE_URL not set"
        return 1
    fi
}

# Configuration backup
backup_configuration() {
    log_info "Creating configuration backup..."
    
    local config_backup="$BACKUP_DIR/config_backup_$TIMESTAMP.tar.gz"
    
    tar -czf "$config_backup" \
        --exclude="node_modules" \
        --exclude=".git" \
        --exclude="backups" \
        -C "$PROJECT_ROOT" \
        supabase/config.toml \
        supabase/.env* \
        scripts/ \
        docs/ \
        .github/
    
    log_success "Configuration backup created: $config_backup"
}

# Functions backup
backup_functions() {
    log_info "Creating functions backup..."
    
    local functions_backup="$BACKUP_DIR/functions_backup_$TIMESTAMP.tar.gz"
    
    tar -czf "$functions_backup" \
        -C "$PROJECT_ROOT" \
        supabase/functions/
    
    log_success "Functions backup created: $functions_backup"
}

# Main backup function
main() {
    log_info "=== Starting Automated Development Pipeline Backup ==="
    log_info "Timestamp: $TIMESTAMP"
    log_info "Backup Directory: $BACKUP_DIR"
    
    backup_database
    backup_configuration  
    backup_functions
    
    log_success "=== Backup completed successfully! ==="
}

main "$@"