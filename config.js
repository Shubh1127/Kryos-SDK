/**
 * Kryos SDK - Configuration Module
 * 
 * Handles SDK configuration loading from environment variables,
 * config objects, and provides validation.
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Config {
  constructor() {
    this.keyId = null;
    this.keySecret = null;
    this.baseUrl = 'http://localhost:5000/api';
    this.enableDefaultMetrics = true;
    this.enableLogging = true;
    this.timeout = 30000;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.version = '1.0.0';
    this.userAgent = 'Kryos-NodeJS-SDK/1.0.0';
  }

  /**
   * Load configuration from options and environment variables
   */
  load(options = {}) {
    // Load from environment variables first
    this.keyId = process.env.KRYOS_KEY_ID || options.keyId;
    this.keySecret = process.env.KRYOS_KEY_SECRET || options.keySecret;
    this.baseUrl = process.env.KRYOS_BASE_URL || options.baseUrl || this.baseUrl;
    
    // Optional configurations
    this.enableDefaultMetrics = process.env.KRYOS_ENABLE_METRICS !== 'false' && 
                               (options.enableDefaultMetrics !== false);
    this.enableLogging = process.env.KRYOS_ENABLE_LOGGING !== 'false' && 
                        (options.enableLogging !== false);
    
    // Advanced configurations
    this.timeout = parseInt(process.env.KRYOS_TIMEOUT) || options.timeout || this.timeout;
    this.retryAttempts = parseInt(process.env.KRYOS_RETRY_ATTEMPTS) || options.retryAttempts || this.retryAttempts;
    this.retryDelay = parseInt(process.env.KRYOS_RETRY_DELAY) || options.retryDelay || this.retryDelay;

    // Custom tags for metrics
    this.customTags = options.customTags || {};
    
    // Service information
    this.serviceName = process.env.KRYOS_SERVICE_NAME || options.serviceName || 'unknown-service';
    this.serviceVersion = process.env.KRYOS_SERVICE_VERSION || options.serviceVersion || '1.0.0';
    this.environment = process.env.NODE_ENV || process.env.KRYOS_ENVIRONMENT || 'development';

    return this;
  }

  /**
   * Validate configuration
   */
  isValid() {
    if (!this.keyId || !this.keySecret) {
      return false;
    }

    if (!this.baseUrl || !this.baseUrl.startsWith('http')) {
      return false;
    }

    return true;
  }

  /**
   * Get API key for authentication
   */
  getApiKey() {
    return `${this.keyId}.${this.keySecret}`;
  }

  /**
   * Get authorization header
   */
  getAuthHeader() {
    return `Bearer ${this.getApiKey()}`;
  }

  /**
   * Get default HTTP headers
   */
  getDefaultHeaders() {
    return {
      'Authorization': this.getAuthHeader(),
      'User-Agent': this.userAgent,
      'Content-Type': 'application/json',
      'X-SDK-Version': this.version,
      'X-Service-Name': this.serviceName,
      'X-Service-Version': this.serviceVersion,
      'X-Environment': this.environment
    };
  }

  /**
   * Get service metadata
   */
  getServiceMetadata() {
    return {
      serviceName: this.serviceName,
      serviceVersion: this.serviceVersion,
      environment: this.environment,
      sdkVersion: this.version,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      customTags: this.customTags
    };
  }

  /**
   * Update configuration at runtime
   */
  update(options = {}) {
    Object.keys(options).forEach(key => {
      if (this.hasOwnProperty(key)) {
        this[key] = options[key];
      }
    });
    return this;
  }

  /**
   * Get configuration as JSON
   */
  toJSON() {
    return {
      keyId: this.keyId ? '***' + this.keyId.slice(-4) : null, // Mask for security
      baseUrl: this.baseUrl,
      enableDefaultMetrics: this.enableDefaultMetrics,
      enableLogging: this.enableLogging,
      timeout: this.timeout,
      retryAttempts: this.retryAttempts,
      retryDelay: this.retryDelay,
      serviceName: this.serviceName,
      serviceVersion: this.serviceVersion,
      environment: this.environment,
      customTags: this.customTags
    };
  }
}

const config = new Config();

export default config;