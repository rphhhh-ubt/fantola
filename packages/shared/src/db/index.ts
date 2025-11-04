// Export database client
export { db, DatabaseClient } from './client';
export type { DatabaseClientOptions } from './client';

// Export repository helpers
export { RepositoryHelpers, repository } from './repository';
export type { PaginationOptions, PaginationResult, TransactionOptions } from './repository';

// Export shutdown utilities
export { ShutdownManager, setupDatabaseShutdown } from './shutdown';
export type { ShutdownOptions } from './shutdown';

// Re-export Prisma types and client
export * from '@monorepo/database';
