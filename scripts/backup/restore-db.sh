#!/bin/bash
set -e

# PostgreSQL restore script

echo "🔄 Starting database restore..."

# Check if backup file is provided
if [ -z "$1" ]; then
  echo "❌ Usage: $0 <backup-file.sql.gz>"
  echo "Available backups:"
  ls -lh ./backups/db/backup_*.sql.gz 2>/dev/null || echo "No backups found"
  exit 1
fi

BACKUP_FILE=$1

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_DB=${POSTGRES_DB:-monorepo}
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}

echo "📊 Database: $POSTGRES_DB"
echo "📁 Backup file: $BACKUP_FILE"

# Warning
echo "⚠️  WARNING: This will DROP and recreate the database!"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Restore cancelled"
  exit 0
fi

# Drop and recreate database
echo "🗑️  Dropping existing database..."
PGPASSWORD=$POSTGRES_PASSWORD psql \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d postgres \
  -c "DROP DATABASE IF EXISTS $POSTGRES_DB;"

echo "📦 Creating new database..."
PGPASSWORD=$POSTGRES_PASSWORD psql \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d postgres \
  -c "CREATE DATABASE $POSTGRES_DB;"

# Restore backup
echo "📥 Restoring backup..."
gunzip -c "$BACKUP_FILE" | PGPASSWORD=$POSTGRES_PASSWORD psql \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --single-transaction

echo "✅ Database restore completed successfully!"
