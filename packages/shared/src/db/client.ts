import { PrismaClient, Prisma } from '@monorepo/database';

export interface DatabaseClientOptions {
  logQueries?: boolean;
  onError?: (error: Error, context?: unknown) => void;
}

class DatabaseClient {
  private static instance: PrismaClient | null = null;
  private static clientOptions: DatabaseClientOptions = {};

  static initialize(options: DatabaseClientOptions = {}): PrismaClient {
    if (this.instance) {
      return this.instance;
    }

    this.clientOptions = options;

    const logLevels: Prisma.LogLevel[] = [];

    if (options.logQueries || process.env.NODE_ENV === 'development') {
      logLevels.push('query');
    }

    logLevels.push('error', 'warn');

    this.instance = new PrismaClient({
      log: logLevels,
      errorFormat: 'pretty',
    });

    return this.instance;
  }

  static getInstance(): PrismaClient {
    if (!this.instance) {
      return this.initialize();
    }
    return this.instance;
  }

  static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.$disconnect();
      this.instance = null;
    }
  }

  static isConnected(): boolean {
    return this.instance !== null;
  }

  static getOptions(): DatabaseClientOptions {
    return this.clientOptions;
  }

  static normalizeError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handleKnownRequestError(error);
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return new Error(`Database validation error: ${error.message}`);
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return new Error(`Database initialization error: ${error.message}`);
    }

    if (error instanceof Prisma.PrismaClientRustPanicError) {
      return new Error(`Database panic error: ${error.message}`);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error(`Unknown database error: ${String(error)}`);
  }

  private static handleKnownRequestError(
    error: Prisma.PrismaClientKnownRequestError
  ): Error {
    switch (error.code) {
      case 'P2002':
        return new Error(
          `Unique constraint violation: ${this.extractConstraintFields(error)}`
        );
      case 'P2003':
        return new Error(`Foreign key constraint violation: ${error.meta?.field_name}`);
      case 'P2025':
        return new Error('Record not found');
      case 'P2016':
        return new Error('Query interpretation error');
      case 'P2021':
        return new Error('Table does not exist');
      case 'P2022':
        return new Error('Column does not exist');
      default:
        return new Error(`Database error (${error.code}): ${error.message}`);
    }
  }

  private static extractConstraintFields(
    error: Prisma.PrismaClientKnownRequestError
  ): string {
    if (error.meta?.target) {
      const target = error.meta.target;
      if (Array.isArray(target)) {
        return target.join(', ');
      }
      return String(target);
    }
    return 'unknown field';
  }
}

// Export singleton instance with explicit type annotation
export const db: PrismaClient = DatabaseClient.getInstance();

// Export class for testing and configuration
export { DatabaseClient };
