import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';

export interface MetricsConfig {
  service: string;
  port?: number;
  enableDefaultMetrics?: boolean;
}

export class MetricsCollector {
  private registry: Registry;
  private service: string;

  public activeUsers: Gauge<string>;
  public generationSuccess: Counter<string>;
  public generationFailure: Counter<string>;
  public tokenSpend: Counter<string>;
  public paymentConversions: Counter<string>;
  public paymentFailures: Counter<string>;
  public queueFailures: Counter<string>;
  public queueJobDuration: Histogram<string>;
  public httpRequestDuration: Histogram<string>;
  public httpRequestTotal: Counter<string>;
  public activeJobs: Gauge<string>;
  public errorCounter: Counter<string>;

  constructor(config: MetricsConfig) {
    this.service = config.service;
    this.registry = new Registry();
    this.registry.setDefaultLabels({
      service: config.service,
    });

    if (config.enableDefaultMetrics !== false) {
      collectDefaultMetrics({ register: this.registry });
    }

    this.activeUsers = new Gauge({
      name: 'active_users_total',
      help: 'Number of active users',
      labelNames: ['service'],
      registers: [this.registry],
    });

    this.generationSuccess = new Counter({
      name: 'generation_success_total',
      help: 'Total number of successful generations',
      labelNames: ['service', 'type'],
      registers: [this.registry],
    });

    this.generationFailure = new Counter({
      name: 'generation_failure_total',
      help: 'Total number of failed generations',
      labelNames: ['service', 'type', 'error_type'],
      registers: [this.registry],
    });

    this.tokenSpend = new Counter({
      name: 'token_spend_total',
      help: 'Total tokens spent across all generations',
      labelNames: ['service', 'model', 'type'],
      registers: [this.registry],
    });

    this.paymentConversions = new Counter({
      name: 'payment_conversions_total',
      help: 'Total number of successful payment conversions',
      labelNames: ['service', 'payment_method', 'plan'],
      registers: [this.registry],
    });

    this.paymentFailures = new Counter({
      name: 'payment_failures_total',
      help: 'Total number of failed payments',
      labelNames: ['service', 'payment_method', 'error_type'],
      registers: [this.registry],
    });

    this.queueFailures = new Counter({
      name: 'queue_failures_total',
      help: 'Total number of queue job failures',
      labelNames: ['service', 'queue_name', 'error_type'],
      registers: [this.registry],
    });

    this.queueJobDuration = new Histogram({
      name: 'queue_job_duration_seconds',
      help: 'Duration of queue jobs in seconds',
      labelNames: ['service', 'queue_name', 'job_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['service', 'method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['service', 'method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.activeJobs = new Gauge({
      name: 'active_jobs_total',
      help: 'Number of currently active jobs',
      labelNames: ['service', 'queue_name'],
      registers: [this.registry],
    });

    this.errorCounter = new Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['service', 'error_type', 'severity'],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getRegistry(): Registry {
    return this.registry;
  }

  trackActiveUser(_userId: string): void {
    this.activeUsers.inc({ service: this.service });
  }

  trackGenerationSuccess(type: string): void {
    this.generationSuccess.inc({ service: this.service, type });
  }

  trackGenerationFailure(type: string, errorType: string): void {
    this.generationFailure.inc({ service: this.service, type, error_type: errorType });
  }

  trackTokenSpend(tokens: number, model: string, type: string): void {
    this.tokenSpend.inc({ service: this.service, model, type }, tokens);
  }

  trackPaymentConversion(paymentMethod: string, plan: string): void {
    this.paymentConversions.inc({ service: this.service, payment_method: paymentMethod, plan });
  }

  trackPaymentFailure(paymentMethod: string, errorType: string): void {
    this.paymentFailures.inc({ service: this.service, payment_method: paymentMethod, error_type: errorType });
  }

  trackQueueFailure(queueName: string, errorType: string): void {
    this.queueFailures.inc({ service: this.service, queue_name: queueName, error_type: errorType });
  }

  startJobTimer(queueName: string, jobType: string): () => void {
    const end = this.queueJobDuration.startTimer({ service: this.service, queue_name: queueName, job_type: jobType });
    return end;
  }

  trackHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestTotal.inc({ service: this.service, method, route, status_code: statusCode.toString() });
    this.httpRequestDuration.observe(
      { service: this.service, method, route, status_code: statusCode.toString() },
      duration
    );
  }

  setActiveJobs(queueName: string, count: number): void {
    this.activeJobs.set({ service: this.service, queue_name: queueName }, count);
  }

  trackError(errorType: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    this.errorCounter.inc({ service: this.service, error_type: errorType, severity });
  }
}
