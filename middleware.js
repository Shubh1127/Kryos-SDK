/**
 * Kryos SDK - Middleware Module
 * 
 * Provides Express middleware for automatic request logging,
 * metrics collection, and error tracking.
 */

import { performance } from 'perf_hooks';

class MiddlewareModule {
  constructor() {
    this.config = null;
    this.monitoring = null;
    this.api = null;
    this.isInitialized = false;
  }

  /**
   * Initialize middleware with configuration and dependencies
   */
  init(config, monitoring = null, api = null) {
    this.config = config;
    this.monitoring = monitoring;
    this.api = api;
    this.isInitialized = true;

    console.log('🔧 Kryos Middleware initialized');
    return this;
  }

  /**
   * Request logging middleware
   * Logs all HTTP requests with timing information
   */
  requestLogger() {
    return (req, res, next) => {
      const startTime = performance.now();
      const timestamp = new Date().toISOString();

      // Log request start
      if (this.config.enableLogging) {
        console.log(`📥 ${timestamp} ${req.method} ${req.url} - ${req.ip}`);
      }

      // Capture original res.end to measure response time
      const originalEnd = res.end;
      res.end = (...args) => {
        const endTime = performance.now();
        const duration = (endTime - startTime) / 1000; // Convert to seconds

        // Log request completion
        if (this.config.enableLogging) {
          console.log(`📤 ${req.method} ${req.url} - ${res.statusCode} - ${duration.toFixed(3)}s`);
        }

        // Record metrics if monitoring is available
        if (this.monitoring) {
          const route = this.getRoutePattern(req);
          this.monitoring.recordHttpRequest(req.method, route, res.statusCode, duration);
        }

        // Call original end method
        originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Metrics collection middleware
   * Automatically collects detailed request metrics
   */
  metricsCollector() {
    return (req, res, next) => {
      const startTime = performance.now();
      const startTimestamp = Date.now();

      // Add request metadata
      req.kryosMetrics = {
        startTime,
        startTimestamp,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        contentLength: req.get('Content-Length') || 0
      };

      // Override res.end to capture final metrics
      const originalEnd = res.end;
      res.end = (...args) => {
        const endTime = performance.now();
        const duration = (endTime - startTime) / 1000;
        
        // Collect comprehensive metrics
        const metrics = {
          method: req.method,
          url: req.url,
          route: this.getRoutePattern(req),
          statusCode: res.statusCode,
          duration,
          requestSize: parseInt(req.get('Content-Length')) || 0,
          responseSize: res.get('Content-Length') || 0,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          timestamp: startTimestamp,
          service: this.config?.serviceName || 'unknown'
        };

        // Record in monitoring system
        if (this.monitoring) {
          this.monitoring.recordHttpRequest(
            metrics.method, 
            metrics.route, 
            metrics.statusCode, 
            metrics.duration
          );
        }

        // Send to API if configured (async, don't block response)
        if (this.api && this.config?.enableLogging) {
          setImmediate(() => {
            this.sendRequestMetrics(metrics).catch(error => {
              console.warn('Failed to send request metrics:', error.message);
            });
          });
        }

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Error tracking middleware
   * Captures and reports application errors
   */
  errorTracker() {
    return (error, req, res, next) => {
      const errorInfo = {
        message: error.message,
        stack: error.stack,
        code: error.code || error.statusCode || 500,
        severity: this.getErrorSeverity(error),
        timestamp: new Date().toISOString(),
        request: {
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          body: req.body ? JSON.stringify(req.body).substring(0, 1000) : null
        },
        service: this.config?.serviceName || 'unknown'
      };

      // Log error
      console.error(`❌ Application Error: ${error.message}`, {
        url: req.url,
        method: req.method,
        stack: error.stack
      });

      // Record error in monitoring
      if (this.monitoring) {
        this.monitoring.recordError(error.name || 'UnknownError', errorInfo.severity);
      }

      // Send error report (async, don't block error response)
      if (this.api) {
        setImmediate(() => {
          this.api.sendError(errorInfo).catch(reportError => {
            console.warn('Failed to send error report:', reportError.message);
          });
        });
      }

      next(error); // Pass error to next error handler
    };
  }

  /**
   * User activity tracking middleware
   * Tracks user actions and sessions
   */
  userActivityTracker() {
    return (req, res, next) => {
      // Extract user information from request
      const userId = req.user?.id || req.headers['x-user-id'] || 'anonymous';
      const userType = req.user?.type || 'guest';
      const action = this.extractUserAction(req);

      if (action) {
        // Record user action in monitoring
        if (this.monitoring) {
          this.monitoring.recordUserAction(action, userType);
        }

        // Send user activity data (async)
        if (this.api && userId !== 'anonymous') {
          setImmediate(() => {
            this.sendUserActivity(userId, action, req).catch(error => {
              console.warn('Failed to send user activity:', error.message);
            });
          });
        }
      }

      next();
    };
  }

  /**
   * Database operation tracking middleware
   * Use this to wrap database operations
   */
  databaseTracker(operation, table) {
    return async (req, res, next) => {
      const startTime = performance.now();
      
      try {
        await next();
        const duration = (performance.now() - startTime) / 1000;
        
        if (this.monitoring) {
          this.monitoring.recordDatabaseOperation(operation, table, 'success', duration);
        }
      } catch (error) {
        const duration = (performance.now() - startTime) / 1000;
        
        if (this.monitoring) {
          this.monitoring.recordDatabaseOperation(operation, table, 'error', duration);
        }
        
        throw error;
      }
    };
  }

  /**
   * Custom metrics middleware
   * Allows injection of custom metrics
   */
  customMetrics(metricsFn) {
    return (req, res, next) => {
      try {
        const customMetrics = metricsFn(req, res);
        
        if (customMetrics && this.monitoring) {
          // Process custom metrics
          Object.entries(customMetrics).forEach(([name, value]) => {
            const metric = this.monitoring.getMetric(name);
            if (metric) {
              if (typeof metric.inc === 'function') {
                metric.inc(value);
              } else if (typeof metric.set === 'function') {
                metric.set(value);
              }
            }
          });
        }
      } catch (error) {
        console.warn('Custom metrics function failed:', error.message);
      }
      
      next();
    };
  }

  /**
   * Health check middleware
   * Provides endpoint for health monitoring
   */
  healthCheck(customChecks = []) {
    return async (req, res) => {
      const startTime = Date.now();
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: this.config?.serviceName || 'unknown',
        version: this.config?.serviceVersion || '1.0.0',
        uptime: process.uptime(),
        checks: {}
      };

      try {
        // Basic system checks
        health.checks.memory = {
          status: 'healthy',
          used: process.memoryUsage(),
          free: require('os').freemem(),
          total: require('os').totalmem()
        };

        health.checks.disk = {
          status: 'healthy' // Add disk check if needed
        };

        // Custom health checks
        for (const check of customChecks) {
          try {
            const result = await check();
            health.checks[check.name || 'custom'] = {
              status: result.status || 'healthy',
              ...result
            };
          } catch (error) {
            health.checks[check.name || 'custom'] = {
              status: 'unhealthy',
              error: error.message
            };
            health.status = 'degraded';
          }
        }

        // API connectivity check
        if (this.api) {
          try {
            await this.api.healthCheck();
            health.checks.kryosApi = { status: 'healthy' };
          } catch (error) {
            health.checks.kryosApi = { 
              status: 'unhealthy', 
              error: error.message 
            };
            health.status = 'degraded';
          }
        }

        health.responseTime = Date.now() - startTime;
        
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);

      } catch (error) {
        health.status = 'unhealthy';
        health.error = error.message;
        health.responseTime = Date.now() - startTime;
        
        res.status(503).json(health);
      }
    };
  }

  /**
   * Helper: Extract route pattern from request
   */
  getRoutePattern(req) {
    // Try to get route from Express route
    if (req.route && req.route.path) {
      return req.route.path;
    }

    // Fallback: simplify URL by replacing IDs with placeholders
    return req.url
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\?.*$/, ''); // Remove query parameters
  }

  /**
   * Helper: Determine error severity
   */
  getErrorSeverity(error) {
    if (error.statusCode) {
      if (error.statusCode >= 500) return 'critical';
      if (error.statusCode >= 400) return 'warning';
    }
    
    if (error.name === 'ValidationError') return 'warning';
    if (error.name === 'UnauthorizedError') return 'warning';
    
    return 'error';
  }

  /**
   * Helper: Extract user action from request
   */
  extractUserAction(req) {
    const method = req.method.toLowerCase();
    const url = req.url.toLowerCase();

    // Define action mapping
    const actionMap = {
      'post:/api/auth/login': 'login',
      'post:/api/auth/logout': 'logout',
      'post:/api/auth/register': 'register',
      'get:/api/profile': 'view_profile',
      'put:/api/profile': 'update_profile',
      'post:/api/orders': 'create_order',
      'get:/api/orders': 'view_orders'
    };

    const key = `${method}:${this.getRoutePattern(req)}`;
    return actionMap[key] || `${method}_${this.getRoutePattern(req).replace(/[^a-z0-9]/g, '_')}`;
  }

  /**
   * Helper: Send request metrics to API
   */
  async sendRequestMetrics(metrics) {
    try {
      await this.api.sendEvent({
        eventType: 'http_request',
        ...metrics
      });
    } catch (error) {
      // Don't throw, just log
      console.warn('Failed to send request metrics:', error.message);
    }
  }

  /**
   * Helper: Send user activity to API
   */
  async sendUserActivity(userId, action, req) {
    try {
      await this.api.sendEvent({
        eventType: 'user_activity',
        userId,
        action,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    } catch (error) {
      // Don't throw, just log
      console.warn('Failed to send user activity:', error.message);
    }
  }
}

const middleware = new MiddlewareModule();

export default middleware;