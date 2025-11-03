#!/bin/bash
set -e

# Database migration script
# Run this script to apply database migrations

echo "🔄 Running database migrations..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Default DATABASE_URL if not set
DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:postgres@localhost:5432/monorepo"}

echo "📊 Database: $DATABASE_URL"

# Check if psql is available
if ! command -v psql &> /dev/null; then
  echo "❌ psql is not installed. Please install PostgreSQL client."
  exit 1
fi

# Run migrations
echo "📝 Applying migrations..."

# Example: Run SQL migration files in order
for file in scripts/db/migrations/*.sql; do
  if [ -f "$file" ]; then
    echo "  → Running $(basename $file)..."
    psql "$DATABASE_URL" -f "$file"
  fi
done

echo "✅ Migrations completed successfully!"
