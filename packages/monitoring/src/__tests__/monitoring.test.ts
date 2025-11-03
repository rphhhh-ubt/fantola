import { Monitoring } from '../monitoring';

describe('Monitoring', () => {
  let monitoring: Monitoring;

  beforeEach(() => {
    monitoring = new Monitoring({
      service: 'test-service',
      environment: 'test',
    });
  });

  describe('Logger', () => {
    it('should create a logger instance', () => {
      expect(monitoring.logger).toBeDefined();
      expect(typeof monitoring.logger.info).toBe('function');
      expect(typeof monitoring.logger.error).toBe('function');
    });

    it('should log messages', () => {
      const logSpy = jest.spyOn(monitoring.logger, 'info');
      monitoring.logger.info('test message');
      expect(logSpy).toHaveBeenCalledWith('test message');
    });
  });

  describe('Metrics', () => {
    it('should create a metrics collector instance', () => {
      expect(monitoring.metrics).toBeDefined();
      expect(typeof monitoring.metrics.trackGenerationSuccess).toBe('function');
    });

    it('should track generation success', () => {
      expect(() => {
        monitoring.metrics.trackGenerationSuccess('image');
      }).not.toThrow();
    });

    it('should track generation failure', () => {
      expect(() => {
        monitoring.metrics.trackGenerationFailure('image', 'timeout');
      }).not.toThrow();
    });

    it('should track token spend', () => {
      expect(() => {
        monitoring.metrics.trackTokenSpend(1000, 'gpt-4', 'completion');
      }).not.toThrow();
    });

    it('should track payment conversion', () => {
      expect(() => {
        monitoring.metrics.trackPaymentConversion('card', 'premium');
      }).not.toThrow();
    });

    it('should get metrics', async () => {
      const metrics = await monitoring.metrics.getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('active_users_total');
    });
  });

  describe('Alerts', () => {
    it('should create an alert manager instance', () => {
      expect(monitoring.alerts).toBeDefined();
      expect(typeof monitoring.alerts.alertQueueFailure).toBe('function');
    });

    it('should alert on queue failure', () => {
      const error = new Error('Test error');
      expect(() => {
        monitoring.alerts.alertQueueFailure('test-queue', error);
      }).not.toThrow();
    });

    it('should alert on payment failure', () => {
      const error = new Error('Payment error');
      expect(() => {
        monitoring.alerts.alertPaymentFailure('payment-123', error);
      }).not.toThrow();
    });
  });

  describe('KPI Tracking', () => {
    it('should track active user KPI', () => {
      expect(() => {
        monitoring.trackKPI({
          type: 'active_user',
          data: { userId: 'user-123' },
        });
      }).not.toThrow();
    });

    it('should track generation success KPI', () => {
      expect(() => {
        monitoring.trackKPI({
          type: 'generation_success',
          data: { type: 'image' },
        });
      }).not.toThrow();
    });

    it('should track generation failure KPI', () => {
      expect(() => {
        monitoring.trackKPI({
          type: 'generation_failure',
          data: { type: 'image', errorType: 'timeout' },
        });
      }).not.toThrow();
    });

    it('should track token spend KPI', () => {
      expect(() => {
        monitoring.trackKPI({
          type: 'token_spend',
          data: { tokens: 1000, model: 'gpt-4', type: 'completion' },
        });
      }).not.toThrow();
    });

    it('should track payment conversion KPI', () => {
      expect(() => {
        monitoring.trackKPI({
          type: 'payment_conversion',
          data: { paymentMethod: 'card', plan: 'premium' },
        });
      }).not.toThrow();
    });

    it('should track payment failure KPI', () => {
      expect(() => {
        monitoring.trackKPI({
          type: 'payment_failure',
          data: { paymentId: 'payment-123', paymentMethod: 'card', errorType: 'declined' },
        });
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle non-critical errors', () => {
      const error = new Error('Test error');
      expect(() => {
        monitoring.handleError(error, { context: 'test' });
      }).not.toThrow();
    });

    it('should handle critical errors', () => {
      const error = new Error('Critical error');
      expect(() => {
        monitoring.handleCriticalError(error, { context: 'test' });
      }).not.toThrow();
    });
  });
});
