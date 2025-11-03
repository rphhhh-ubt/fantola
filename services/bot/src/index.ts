import { getConfig } from '@monorepo/config';
import { formatDate } from '@monorepo/shared';

async function main() {
  const config = getConfig();
  console.log(`Bot service started in ${config.nodeEnv} mode`);
  console.log(`Current time: ${formatDate(new Date())}`);
}

main().catch((error) => {
  console.error('Bot service failed to start:', error);
  process.exit(1);
});
