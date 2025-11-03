#!/bin/bash
set -e

# PostgreSQL backup script

echo "🔄 Starting database backup..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups/db}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_DB=${POSTGRES_DB:-monorepo}
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "📊 Database: $POSTGRES_DB"
echo "📁 Backup location: $BACKUP_FILE"

# Create backup
PGPASSWORD=$POSTGRES_PASSWORD pg_dump \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --format=plain \
  --no-owner \
  --no-privileges \
  | gzip > "$BACKUP_FILE"

echo "✅ Backup completed: $BACKUP_FILE"

# Calculate file size
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "📦 Backup size: $SIZE"

# Optional: Upload to S3
if [ ! -z "$S3_BACKUP_BUCKET" ]; then
  echo "☁️  Uploading to S3..."
  if command -v aws &> /dev/null; then
    aws s3 cp "$BACKUP_FILE" "s3://$S3_BACKUP_BUCKET/database/"
    echo "✅ Uploaded to S3: s3://$S3_BACKUP_BUCKET/database/$(basename $BACKUP_FILE)"
  else
    echo "⚠️  AWS CLI not found. Skipping S3 upload."
  fi
fi

# Optional: Clean up old backups (keep last 7 days)
if [ "$CLEANUP_OLD_BACKUPS" = "true" ]; then
  echo "🧹 Cleaning up old backups (keeping last 7 days)..."
  find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +7 -delete
  echo "✅ Cleanup completed"
fi

echo "🎉 Database backup completed successfully!"
