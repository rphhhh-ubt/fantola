import * as Sentry from '@sentry/node';

export interface SentryConfig {
  dsn?: string;
  environment?: string;
  service: string;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
  enabled?: boolean;
}

export function initializeSentry(config: SentryConfig): void {
  if (!config.enabled || !config.dsn) {
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment || 'development',
    tracesSampleRate: config.tracesSampleRate ?? 1.0,
    beforeSend(event) {
      event.tags = {
        ...event.tags,
        service: config.service,
      };
      return event;
    },
  });
}

export function captureException(error: Error, context?: Record<string, any>): void {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>): void {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureMessage(message, level);
}

export function setUser(user: { id: string; email?: string; username?: string }): void {
  Sentry.setUser(user);
}

export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  Sentry.addBreadcrumb(breadcrumb);
}

export function startTransaction(name: string, op: string): Sentry.Transaction {
  return Sentry.startTransaction({ name, op });
}

export { Sentry };
