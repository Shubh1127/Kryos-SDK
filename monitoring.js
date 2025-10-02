/**
 * Kryos SDK - Monitoring Module
 * 
 * Collects system metrics using prom-client and provides
 * functions to gather performance data from Node.js applications.
 */

import client from 'prom-client';
import { EventEmitter } from 'events';
import os from 'os';

class MonitoringModule extends EventEmitter {
  constructor() {
    super();
    this.config = null;
    this.register = new client.Registry();
    this.defaultMetricsInterval = null;
    this.customMetrics = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize monitoring with configuration
   */
  init(config) {
    this.config = config;
    this.isInitialized = true;

    // Set default labels for all metrics
    this.register.setDefaultLabels({
      service: config.serviceName,
      version: config.serviceVersion,
      environment: config.environment,
      ...config.customTags
    });

    // Initialize custom metrics
    this.initializeCustomMetrics();

    console.log('📊 Kryos Monitoring initialized');
    return this;
  }

  /**
   * Initialize custom metrics
   */
  initializeCustomMetrics() {
    // HTTP request metrics
    this.httpRequestsTotal = new client.Counter({
      name: 'kryos_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register]
    });

    this.httpRequestDuration = new client.Histogram({
      name: 'kryos_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.register]
    });

    // Database metrics
    this.databaseOperationsTotal = new client.Counter({
      name: 'kryos_database_operations_total',
      help: 'Total number of database operations',
      labelNames: ['operation', 'table', 'status'],
      registers: [this.register]
    });

    this.databaseOperationDuration = new client.Histogram({
      name: 'kryos_database_operation_duration_seconds',
      help: 'Duration of database operations in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.register]
    });

    // Custom business metrics
    this.userActionsTotal = new client.Counter({
      name: 'kryos_user_actions_total',
      help: 'Total number of user actions',
      labelNames: ['action', 'user_type'],
      registers: [this.register]
    });

    this.activeUsersGauge = new client.Gauge({
      name: 'kryos_active_users',
      help: 'Number of currently active users',
      registers: [this.register]
    });

    // Error metrics
    this.errorsTotal = new client.Counter({
      name: 'kryos_errors_total',
      help: 'Total number of application errors',
      labelNames: ['type', 'severity'],
      registers: [this.register]
    });

    // Store references for easy access
    this.customMetrics.set('httpRequestsTotal', this.httpRequestsTotal);
    this.customMetrics.set('httpRequestDuration', this.httpRequestDuration);
    this.customMetrics.set('databaseOperationsTotal', this.databaseOperationsTotal);
    this.customMetrics.set('databaseOperationDuration', this.databaseOperationDuration);
    this.customMetrics.set('userActionsTotal', this.userActionsTotal);
    this.customMetrics.set('activeUsersGauge', this.activeUsersGauge);
    this.customMetrics.set('errorsTotal', this.errorsTotal);
  }

  /**
   * Start collecting default Node.js metrics
   */
  startDefaultCollection(intervalMs = 10000) {
    if (this.defaultMetricsInterval) {
      console.warn('Default metrics collection already started');
      return;
    }

    // Collect default metrics
    client.collectDefaultMetrics({
      register: this.register,
      timeout: 5000,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });

    // Custom system metrics collection
    this.defaultMetricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);

    console.log(`📊 Started default metrics collection (interval: ${intervalMs}ms)`);
  }

  /**
   * Collect custom system metrics
   */
  collectSystemMetrics() {
    try {
      // CPU usage
      const cpuUsage = process.cpuUsage();
      
      // Memory usage
      const memUsage = process.memoryUsage();
      
      // System load
      const loadAvg = os.loadavg();
      
      // Emit metrics collected event
      this.emit('metricsCollected', {
        cpu: cpuUsage,
        memory: memUsage,
        load: loadAvg,
        uptime: process.uptime(),
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error collecting system metrics:', error);
    }
  }

  /**
   * Get all metrics in Prometheus format
   */
  async getMetrics() {
    try {
      return await this.register.metrics();
    } catch (error) {
      console.error('Error getting metrics:', error);
      throw error;
    }
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsJSON() {
    try {
      const metrics = await this.register.getMetricsAsJSON();
      return metrics;
    } catch (error) {
      console.error('Error getting metrics as JSON:', error);
      throw error;
    }
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(method, route, statusCode, duration) {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
  }

  /**
   * Record database operation
   */
  recordDatabaseOperation(operation, table, status, duration) {
    this.databaseOperationsTotal.inc({ operation, table, status });
    this.databaseOperationDuration.observe({ operation, table }, duration);
  }

  /**
   * Record user action
   */
  recordUserAction(action, userType = 'regular') {
    this.userActionsTotal.inc({ action, user_type: userType });
  }

  /**
   * Set active users count
   */
  setActiveUsers(count) {
    this.activeUsersGauge.set(count);
  }

  /**
   * Record error
   */
  recordError(type, severity = 'error') {
    this.errorsTotal.inc({ type, severity });
  }

  /**
   * Create custom counter
   */
  createCounter(name, help, labelNames = []) {
    const counter = new client.Counter({
      name: `kryos_${name}`,
      help,
      labelNames,
      registers: [this.register]
    });
    this.customMetrics.set(name, counter);
    return counter;
  }

  /**
   * Create custom gauge
   */
  createGauge(name, help, labelNames = []) {
    const gauge = new client.Gauge({
      name: `kryos_${name}`,
      help,
      labelNames,
      registers: [this.register]
    });
    this.customMetrics.set(name, gauge);
    return gauge;
  }

  /**
   * Create custom histogram
   */
  createHistogram(name, help, labelNames = [], buckets = []) {
    const histogram = new client.Histogram({
      name: `kryos_${name}`,
      help,
      labelNames,
      buckets: buckets.length ? buckets : client.exponentialBuckets(0.005, 2, 10),
      registers: [this.register]
    });
    this.customMetrics.set(name, histogram);
    return histogram;
  }

  /**
   * Get custom metric by name
   */
  getMetric(name) {
    return this.customMetrics.get(name);
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.register.resetMetrics();
  }

  /**
   * Stop metrics collection
   */
  stop() {
    if (this.defaultMetricsInterval) {
      clearInterval(this.defaultMetricsInterval);
      this.defaultMetricsInterval = null;
      console.log('📊 Stopped metrics collection');
    }
  }

  /**
   * Get current system information
   */
  getSystemInfo() {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      nodeVersion: process.version,
      pid: process.pid
    };
  }
}

const monitoring = new MonitoringModule();

export default monitoring;