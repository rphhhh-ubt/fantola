import { QueueName } from './types';

/**
 * Queue naming prefix
 */
const QUEUE_PREFIX = process.env.QUEUE_PREFIX || 'monorepo';

/**
 * Environment-specific queue suffix
 */
const ENV_SUFFIX = process.env.NODE_ENV === 'production' ? '' : `-${process.env.NODE_ENV || 'dev'}`;

/**
 * Get the full queue name with prefix and environment suffix
 */
export function getQueueName(name: QueueName | string): string {
  return `${QUEUE_PREFIX}:${name}${ENV_SUFFIX}`;
}

/**
 * Get the queue name without prefix/suffix (for display purposes)
 */
export function getQueueDisplayName(fullName: string): string {
  const prefix = `${QUEUE_PREFIX}:`;
  let name = fullName;

  if (name.startsWith(prefix)) {
    name = name.substring(prefix.length);
  }

  if (ENV_SUFFIX && name.endsWith(ENV_SUFFIX)) {
    name = name.substring(0, name.length - ENV_SUFFIX.length);
  }

  return name;
}

/**
 * Get job ID with prefix
 */
export function getJobId(queueName: QueueName | string, identifier: string): string {
  return `${queueName}:${identifier}`;
}

/**
 * Parse job ID to extract queue name and identifier
 */
export function parseJobId(jobId: string): { queueName: string; identifier: string } | null {
  const parts = jobId.split(':');
  if (parts.length < 2) {
    return null;
  }

  const queueName = parts[0];
  const identifier = parts.slice(1).join(':');

  return { queueName, identifier };
}

/**
 * Get Redis key for queue metadata
 */
export function getQueueMetadataKey(queueName: QueueName | string): string {
  return `${QUEUE_PREFIX}:meta:${queueName}`;
}

/**
 * Get Redis key for queue events
 */
export function getQueueEventsKey(queueName: QueueName | string): string {
  return `${QUEUE_PREFIX}:events:${queueName}`;
}

/**
 * Get Redis key for queue metrics
 */
export function getQueueMetricsKey(queueName: QueueName | string): string {
  return `${QUEUE_PREFIX}:metrics:${queueName}`;
}

/**
 * Queue naming conventions
 */
export const QueueNaming = {
  getQueueName,
  getQueueDisplayName,
  getJobId,
  parseJobId,
  getQueueMetadataKey,
  getQueueEventsKey,
  getQueueMetricsKey,
  prefix: QUEUE_PREFIX,
  envSuffix: ENV_SUFFIX,
};
