import { getConfig } from '@monorepo/config';
import { isValidEmail } from '@monorepo/shared';

async function main() {
  const config = getConfig();
  console.log(`API service started on port ${config.port} in ${config.nodeEnv} mode`);
  console.log(`Email validation example: ${isValidEmail('test@example.com')}`);
}

main().catch((error) => {
  console.error('API service failed to start:', error);
  process.exit(1);
});
