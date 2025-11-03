#!/bin/bash
set -e

# Storage backup script (S3/Object Storage)

echo "🔄 Starting storage backup..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups/storage}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_BUCKET=${S3_BUCKET:-}
BACKUP_DESTINATION_BUCKET=${S3_BACKUP_BUCKET:-}

if [ -z "$BACKUP_BUCKET" ]; then
  echo "❌ S3_BUCKET environment variable is not set"
  exit 1
fi

if [ -z "$BACKUP_DESTINATION_BUCKET" ]; then
  echo "❌ S3_BACKUP_BUCKET environment variable is not set"
  exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "☁️  Source bucket: $BACKUP_BUCKET"
echo "☁️  Backup bucket: $BACKUP_DESTINATION_BUCKET"

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
  echo "❌ AWS CLI is not installed"
  exit 1
fi

# Sync S3 bucket to backup bucket
echo "📦 Syncing storage..."
aws s3 sync \
  "s3://$BACKUP_BUCKET" \
  "s3://$BACKUP_DESTINATION_BUCKET/storage-backups/$TIMESTAMP" \
  --storage-class STANDARD_IA

echo "✅ Storage backup completed!"
echo "📍 Backup location: s3://$BACKUP_DESTINATION_BUCKET/storage-backups/$TIMESTAMP"

# Optional: Create local backup
if [ "$LOCAL_BACKUP" = "true" ]; then
  echo "💾 Creating local backup..."
  LOCAL_BACKUP_DIR="$BACKUP_DIR/$TIMESTAMP"
  mkdir -p "$LOCAL_BACKUP_DIR"
  
  aws s3 sync \
    "s3://$BACKUP_BUCKET" \
    "$LOCAL_BACKUP_DIR"
  
  echo "✅ Local backup completed: $LOCAL_BACKUP_DIR"
fi

echo "🎉 Storage backup completed successfully!"
