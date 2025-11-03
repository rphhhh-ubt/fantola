import { Logger } from './logger';
import { captureMessage } from './sentry';

export interface AlertConfig {
  logger: Logger;
  webhookUrl?: string;
  enableSlack?: boolean;
  enableSentry?: boolean;
}

export interface Alert {
  type: 'queue_failure' | 'payment_failure' | 'high_error_rate' | 'service_degradation' | 'critical_error';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  context?: Record<string, any>;
  timestamp: Date;
}

export class AlertManager {
  private config: AlertConfig;
  private alertThresholds: Map<string, number> = new Map();
  private alertCounts: Map<string, number> = new Map();

  constructor(config: AlertConfig) {
    this.config = config;
    this.setDefaultThresholds();
  }

  private setDefaultThresholds(): void {
    this.alertThresholds.set('queue_failure', 5);
    this.alertThresholds.set('payment_failure', 3);
    this.alertThresholds.set('high_error_rate', 10);
  }

  async sendAlert(alert: Alert): Promise<void> {
    const alertKey = `${alert.type}_${alert.severity}`;
    const currentCount = (this.alertCounts.get(alertKey) || 0) + 1;
    this.alertCounts.set(alertKey, currentCount);

    const threshold = this.alertThresholds.get(alert.type) || 1;

    if (currentCount >= threshold) {
      this.config.logger.error({
        alert: {
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          context: alert.context,
          timestamp: alert.timestamp,
          occurrences: currentCount,
        },
      }, `Alert triggered: ${alert.message}`);

      if (this.config.enableSentry && alert.severity !== 'warning') {
        captureMessage(
          `[${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}`,
          alert.severity === 'critical' ? 'fatal' : 'error',
          {
            alert_type: alert.type,
            ...alert.context,
          }
        );
      }

      if (this.config.webhookUrl) {
        await this.sendWebhookAlert(alert, currentCount);
      }

      this.alertCounts.set(alertKey, 0);
    }
  }

  private async sendWebhookAlert(alert: Alert, occurrences: number): Promise<void> {
    if (!this.config.webhookUrl) {
      return;
    }

    try {
      const payload = {
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        context: alert.context,
        timestamp: alert.timestamp.toISOString(),
        occurrences,
      };

      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.config.logger.error({
          error: 'Failed to send webhook alert',
          status: response.status,
          statusText: response.statusText,
        });
      }
    } catch (error) {
      this.config.logger.error({
        error: 'Error sending webhook alert',
        err: error,
      });
    }
  }

  alertQueueFailure(queueName: string, error: Error, jobData?: Record<string, any>): void {
    this.sendAlert({
      type: 'queue_failure',
      severity: 'error',
      message: `Queue ${queueName} job failed: ${error.message}`,
      context: {
        queue: queueName,
        error: error.message,
        stack: error.stack,
        jobData,
      },
      timestamp: new Date(),
    }).catch((err) => {
      this.config.logger.error({ err }, 'Failed to send queue failure alert');
    });
  }

  alertPaymentFailure(paymentId: string, error: Error, paymentData?: Record<string, any>): void {
    this.sendAlert({
      type: 'payment_failure',
      severity: 'critical',
      message: `Payment ${paymentId} failed: ${error.message}`,
      context: {
        paymentId,
        error: error.message,
        stack: error.stack,
        paymentData,
      },
      timestamp: new Date(),
    }).catch((err) => {
      this.config.logger.error({ err }, 'Failed to send payment failure alert');
    });
  }

  alertHighErrorRate(service: string, errorCount: number, timeWindow: string): void {
    this.sendAlert({
      type: 'high_error_rate',
      severity: 'warning',
      message: `High error rate detected in ${service}: ${errorCount} errors in ${timeWindow}`,
      context: {
        service,
        errorCount,
        timeWindow,
      },
      timestamp: new Date(),
    }).catch((err) => {
      this.config.logger.error({ err }, 'Failed to send high error rate alert');
    });
  }

  alertServiceDegradation(service: string, metric: string, value: number, threshold: number): void {
    this.sendAlert({
      type: 'service_degradation',
      severity: 'warning',
      message: `Service degradation detected: ${metric} is ${value}, threshold is ${threshold}`,
      context: {
        service,
        metric,
        value,
        threshold,
      },
      timestamp: new Date(),
    }).catch((err) => {
      this.config.logger.error({ err }, 'Failed to send service degradation alert');
    });
  }

  alertCriticalError(error: Error, context?: Record<string, any>): void {
    this.sendAlert({
      type: 'critical_error',
      severity: 'critical',
      message: `Critical error: ${error.message}`,
      context: {
        error: error.message,
        stack: error.stack,
        ...context,
      },
      timestamp: new Date(),
    }).catch((err) => {
      this.config.logger.error({ err }, 'Failed to send critical error alert');
    });
  }
}
