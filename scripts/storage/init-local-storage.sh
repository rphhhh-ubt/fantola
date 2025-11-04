#!/bin/bash

set -e

echo "🏗️  Initializing local storage directories..."

# Create base directory
STORAGE_BASE="${STORAGE_LOCAL_PATH:-/var/www/storage}"

echo "📁 Creating directories in: $STORAGE_BASE"

# Create subdirectories
mkdir -p "$STORAGE_BASE/uploads"
mkdir -p "$STORAGE_BASE/generated"
mkdir -p "$STORAGE_BASE/processed"

# Set permissions (if running as root)
if [ "$EUID" -eq 0 ]; then
  echo "🔒 Setting permissions..."
  chown -R 1000:1000 "$STORAGE_BASE"
  chmod -R 755 "$STORAGE_BASE"
fi

echo "✅ Storage directories initialized!"
echo ""
echo "Directory structure:"
tree -L 2 "$STORAGE_BASE" 2>/dev/null || ls -la "$STORAGE_BASE"
