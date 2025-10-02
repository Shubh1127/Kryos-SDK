/**
 * Kryos SDK - Main Entry Point
 * 
 * Initialize the SDK with API credentials and configuration.
 * Provides access to monitoring, API, and middleware modules.
 * 
 * Usage:
 *   import KryosSDK from 'kryos-sdk';
 *   
 *   const kryos = KryosSDK.init({
 *     keyId: 'your_key_id',
 *     keySecret: 'your_key_secret',
 *     baseUrl: 'https://api.kryos.com'
 *   });
 */

import config from './config.js';
import monitoring from './monitoring.js';
import api from './api.js';
import middleware from './middleware.js';
import utils from './utils.js';

class KryosSDK {
  constructor(options = {}) {
    // Validate required options
    if (!options.keyId || !options.keySecret) {
      throw new Error('Kryos SDK: keyId and keySecret are required');
    }

    // Initialize configuration
    this.config = config.load(options);
    
    // Validate configuration
    if (!this.config.isValid()) {
      throw new Error('Kryos SDK: Invalid configuration provided');
    }

    // Initialize modules with configuration
    this.monitoring = monitoring.init(this.config);
    this.api = api.init(this.config);
    this.middleware = middleware.init(this.config);
    this.utils = utils;

    // Set up default monitoring if enabled
    if (this.config.enableDefaultMetrics) {
      this.monitoring.startDefaultCollection();
    }

    console.log(`🚀 Kryos SDK initialized successfully`);
    console.log(`📊 Monitoring: ${this.config.enableDefaultMetrics ? 'Enabled' : 'Disabled'}`);
    console.log(`🔗 API Endpoint: ${this.config.baseUrl}`);
  }

  /**
   * Get current SDK configuration
   */
  getConfig() {
    return {
      keyId: this.config.keyId,
      baseUrl: this.config.baseUrl,
      enableDefaultMetrics: this.config.enableDefaultMetrics,
      enableLogging: this.config.enableLogging,
      version: this.config.version
    };
  }

  /**
   * Test API connectivity
   */
  async testConnection() {
    try {
      const result = await this.api.healthCheck();
      console.log('✅ Kryos API connection successful');
      return result;
    } catch (error) {
      console.error('❌ Kryos API connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Get current metrics in Prometheus format
   */
  async getMetrics() {
    return await this.monitoring.getMetrics();
  }

  /**
   * Send user data to Kryos
   */
  async sendUserData(userData, files = []) {
    return await this.api.sendUserData(userData, files);
  }

  /**
   * Send custom data entry to Kryos
   */
  async sendEntryData(entryData, files = []) {
    return await this.api.sendEntryData(entryData, files);
  }

  /**
   * Send current metrics to Kryos
   */
  async sendMetrics(customMetrics = {}) {
    const systemMetrics = await this.monitoring.getMetrics();
    return await this.api.sendMetrics({
      system: systemMetrics,
      custom: customMetrics,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get Express middleware for request logging
   */
  getRequestLogger() {
    return this.middleware.requestLogger();
  }

  /**
   * Get Express middleware for metrics collection
   */
  getMetricsMiddleware() {
    return this.middleware.metricsCollector();
  }

  /**
   * Graceful shutdown - stop metrics collection
   */
  async shutdown() {
    console.log('🔄 Shutting down Kryos SDK...');
    this.monitoring.stop();
    console.log('✅ Kryos SDK shutdown complete');
  }
}

/**
 * Static initialization method
 */
KryosSDK.init = (options) => {
  return new KryosSDK(options);
};

/**
 * SDK Version
 */
KryosSDK.version = '1.0.0';

/**
 * Export utilities for direct access
 */
KryosSDK.utils = utils;

export default KryosSDK;