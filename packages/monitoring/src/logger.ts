import pino from 'pino';

export interface LoggerConfig {
  level?: string;
  service: string;
  environment?: string;
  pretty?: boolean;
}

export function createLogger(config: LoggerConfig) {
  const isDevelopment = config.environment === 'development' || config.pretty;

  const logger = pino({
    level: config.level || 'info',
    base: {
      service: config.service,
      environment: config.environment || 'development',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    ...(isDevelopment && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    }),
  });

  return logger;
}

export type Logger = ReturnType<typeof createLogger>;
