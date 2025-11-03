import { Monitoring } from '../monitoring';

export interface ExpressMiddlewareOptions {
  monitoring: Monitoring;
  ignorePaths?: string[];
}

export function createExpressMetricsMiddleware(options: ExpressMiddlewareOptions) {
  const { monitoring, ignorePaths = ['/health', '/metrics'] } = options;

  return (req: any, res: any, next: any) => {
    const shouldIgnore = ignorePaths.some((path) => req.path === path || req.url === path);

    if (shouldIgnore) {
      return next();
    }

    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path || req.path || req.url;

      monitoring.metrics.trackHttpRequest(req.method, route, res.statusCode, duration);

      if (res.statusCode >= 400) {
        monitoring.logger.warn({
          method: req.method,
          route,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('user-agent'),
        }, `HTTP ${res.statusCode} ${req.method} ${route}`);
      } else {
        monitoring.logger.debug({
          method: req.method,
          route,
          statusCode: res.statusCode,
          duration,
        }, `HTTP ${res.statusCode} ${req.method} ${route}`);
      }
    });

    next();
  };
}

export function createExpressErrorHandler(monitoring: Monitoring) {
  return (err: Error, req: any, res: any, next: any) => {
    monitoring.handleError(err, {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
    });

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    }

    next(err);
  };
}
