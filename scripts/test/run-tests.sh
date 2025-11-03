#!/bin/bash

# Test runner script for CI/CD environments
set -e

echo "🧪 Running tests..."

# Check if we're in CI environment
if [ -n "$CI" ]; then
  echo "Running in CI mode..."
  pnpm test:ci
else
  echo "Running in development mode..."
  pnpm test
fi

echo "✅ All tests passed!"
