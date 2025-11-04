import dotenvFlow from 'dotenv-flow';
import path from 'path';

/**
 * Load environment variables from .env files using dotenv-flow
 * Supports .env, .env.local, .env.[environment], .env.[environment].local
 * 
 * Priority (highest to lowest):
 * 1. .env.local
 * 2. .env.[NODE_ENV].local
 * 3. .env.[NODE_ENV]
 * 4. .env
 */
export function loadEnv(): void {
  const projectRoot = path.resolve(__dirname, '../../../');
  const isTest = process.env.NODE_ENV === 'test';
  
  dotenvFlow.config({
    path: projectRoot,
    silent: isTest, // Silent in test mode to avoid noise
  });
}
