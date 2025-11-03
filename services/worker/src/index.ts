import { getConfig } from '@monorepo/config';
import { formatDate } from '@monorepo/shared';

async function main() {
  const config = getConfig();
  console.log(`Worker service started in ${config.nodeEnv} mode`);
  console.log(`Processing jobs at ${formatDate(new Date())}`);
}

main().catch((error) => {
  console.error('Worker service failed to start:', error);
  process.exit(1);
});
