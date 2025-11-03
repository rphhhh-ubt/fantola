#!/bin/bash
set -e

# Health check script for monitoring service status

echo "🏥 Running health checks..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration
API_URL=${API_URL:-http://localhost:3000}
TIMEOUT=${HEALTH_CHECK_TIMEOUT:-5}
FAILURES=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_service() {
  local name=$1
  local url=$2
  local expected_code=${3:-200}
  
  echo -n "Checking $name... "
  
  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "000")
  
  if [ "$response" = "$expected_code" ]; then
    echo -e "${GREEN}✓ OK${NC} (HTTP $response)"
    return 0
  else
    echo -e "${RED}✗ FAILED${NC} (HTTP $response)"
    FAILURES=$((FAILURES + 1))
    return 1
  fi
}

check_postgres() {
  echo -n "Checking PostgreSQL... "
  
  if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
      echo -e "${GREEN}✓ OK${NC}"
      return 0
    else
      echo -e "${RED}✗ FAILED${NC} (Connection error)"
      FAILURES=$((FAILURES + 1))
      return 1
    fi
  else
    echo -e "${YELLOW}⊘ SKIPPED${NC} (psql not installed)"
    return 0
  fi
}

check_redis() {
  echo -n "Checking Redis... "
  
  if command -v redis-cli &> /dev/null; then
    REDIS_HOST=${REDIS_HOST:-localhost}
    REDIS_PORT=${REDIS_PORT:-6379}
    
    if [ ! -z "$REDIS_PASSWORD" ]; then
      if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" ping &> /dev/null; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
      fi
    else
      if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping &> /dev/null; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
      fi
    fi
    
    echo -e "${RED}✗ FAILED${NC} (Connection error)"
    FAILURES=$((FAILURES + 1))
    return 1
  else
    echo -e "${YELLOW}⊘ SKIPPED${NC} (redis-cli not installed)"
    return 0
  fi
}

# Run checks
echo ""
check_service "API Health" "$API_URL/health"
echo ""
check_postgres
check_redis

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ $FAILURES check(s) failed!${NC}"
  exit 1
fi
