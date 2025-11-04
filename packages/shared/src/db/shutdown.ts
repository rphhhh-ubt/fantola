import { DatabaseClient } from './client';

export interface ShutdownOptions {
  /**
   * Timeout in milliseconds before force shutdown
   */
  timeout?: number;
  /**
   * Custom cleanup handlers to run before database disconnect
   */
  cleanupHandlers?: Array<() => Promise<void>>;
  /**
   * Logger function for shutdown events
   */
  logger?: (message: string) => void;
}

export class ShutdownManager {
  private isShuttingDown = false;
  private cleanupHandlers: Array<() => Promise<void>> = [];
  private logger: (message: string) => void;

  constructor(options: ShutdownOptions = {}) {
    this.logger = options.logger || console.log;

    if (options.cleanupHandlers) {
      this.cleanupHandlers.push(...options.cleanupHandlers);
    }
  }

  /**
   * Register a cleanup handler
   */
  addCleanupHandler(handler: () => Promise<void>): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Setup graceful shutdown hooks for Prisma
   */
  setupGracefulShutdown(options: ShutdownOptions = {}): void {
    const timeout = options.timeout || 10000;

    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        this.logger(`Already shutting down, ignoring ${signal}`);
        return;
      }

      this.isShuttingDown = true;
      this.logger(`Received ${signal}, starting graceful shutdown...`);

      // Setup timeout to force shutdown if cleanup takes too long
      const forceShutdownTimer = setTimeout(() => {
        this.logger('Shutdown timeout exceeded, forcing exit...');
        process.exit(1);
      }, timeout);

      try {
        // Run cleanup handlers
        if (this.cleanupHandlers.length > 0) {
          this.logger(`Running ${this.cleanupHandlers.length} cleanup handler(s)...`);
          await Promise.all(this.cleanupHandlers.map((handler) => handler()));
        }

        // Disconnect database
        if (DatabaseClient.isConnected()) {
          this.logger('Disconnecting database...');
          await DatabaseClient.disconnect();
          this.logger('Database disconnected successfully');
        }

        clearTimeout(forceShutdownTimer);
        this.logger('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        clearTimeout(forceShutdownTimer);
        this.logger(`Error during shutdown: ${error}`);
        process.exit(1);
      }
    };

    // Handle termination signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      this.logger(`Uncaught exception: ${error.message}`);
      shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason) => {
      this.logger(`Unhandled rejection: ${reason}`);
      shutdown('UNHANDLED_REJECTION');
    });

    this.logger('Graceful shutdown hooks registered');
  }

  /**
   * Manually trigger shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger('Manual shutdown triggered...');

    try {
      // Run cleanup handlers
      if (this.cleanupHandlers.length > 0) {
        await Promise.all(this.cleanupHandlers.map((handler) => handler()));
      }

      // Disconnect database
      if (DatabaseClient.isConnected()) {
        await DatabaseClient.disconnect();
      }

      this.logger('Manual shutdown completed');
    } catch (error) {
      this.logger(`Error during manual shutdown: ${error}`);
      throw error;
    }
  }
}

/**
 * Convenience function to setup graceful shutdown with default options
 */
export function setupDatabaseShutdown(options: ShutdownOptions = {}): ShutdownManager {
  const manager = new ShutdownManager(options);
  manager.setupGracefulShutdown(options);
  return manager;
}
