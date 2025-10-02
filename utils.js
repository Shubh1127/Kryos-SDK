/**
 * Kryos SDK - Utilities Module
 * 
 * Provides helper functions for data validation, hashing,
 * error handling, and other common operations.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

class UtilitiesModule {
  constructor() {
    this.isInitialized = true;
  }

  /**
   * Generate secure hash for data
   */
  generateHash(data, algorithm = 'sha256') {
    try {
      const hash = crypto.createHash(algorithm);
      if (typeof data === 'object') {
        hash.update(JSON.stringify(data));
      } else {
        hash.update(String(data));
      }
      return hash.digest('hex');
    } catch (error) {
      throw new Error(`Hash generation failed: ${error.message}`);
    }
  }

  /**
   * Generate unique ID
   */
  generateUniqueId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
  }

  /**
   * Generate UUID v4
   */
  generateUUID() {
    return crypto.randomUUID();
  }

  /**
   * Validate file paths and check existence
   */
  validateFilePaths(filePaths) {
    if (!Array.isArray(filePaths)) {
      throw new Error('File paths must be an array');
    }

    const results = {
      valid: [],
      invalid: [],
      missing: [],
      totalSize: 0
    };

    for (const filePath of filePaths) {
      try {
        if (!filePath || typeof filePath !== 'string') {
          results.invalid.push({
            path: filePath,
            reason: 'Invalid path format'
          });
          continue;
        }

        if (!fs.existsSync(filePath)) {
          results.missing.push({
            path: filePath,
            reason: 'File does not exist'
          });
          continue;
        }

        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
          results.invalid.push({
            path: filePath,
            reason: 'Path is not a file'
          });
          continue;
        }

        results.valid.push({
          path: filePath,
          size: stats.size,
          ext: path.extname(filePath),
          name: path.basename(filePath)
        });

        results.totalSize += stats.size;

      } catch (error) {
        results.invalid.push({
          path: filePath,
          reason: error.message
        });
      }
    }

    return results;
  }

  /**
   * Validate user data structure
   */
  validateUserData(userData) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!userData.externalId) {
      errors.push('externalId is required');
    }

    if (!userData.name) {
      errors.push('name is required');
    }

    if (!userData.email) {
      errors.push('email is required');
    }

    // Validate email format
    if (userData.email && !this.isValidEmail(userData.email)) {
      errors.push('email format is invalid');
    }

    // Validate phone format (if provided)
    if (userData.phone && !this.isValidPhone(userData.phone)) {
      warnings.push('phone format may be invalid');
    }

    // Validate data types
    if (userData.metadata && typeof userData.metadata !== 'object') {
      errors.push('metadata must be an object');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate entry data structure
   */
  validateEntryData(entryData) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!entryData.externalId) {
      errors.push('externalId is required');
    }

    if (!entryData.dataType) {
      errors.push('dataType is required');
    }

    if (!entryData.data) {
      errors.push('data is required');
    }

    // Validate dataType values
    const validDataTypes = ['user_data', 'event_data', 'custom_data'];
    if (entryData.dataType && !validDataTypes.includes(entryData.dataType)) {
      errors.push(`dataType must be one of: ${validDataTypes.join(', ')}`);
    }

    // Validate data is object
    if (entryData.data && typeof entryData.data !== 'object') {
      errors.push('data must be an object');
    }

    // Validate tags if provided
    if (entryData.tags && !Array.isArray(entryData.tags)) {
      errors.push('tags must be an array');
    }

    // Validate user data if provided
    if (entryData.user) {
      const userValidation = this.validateUserData(entryData.user);
      if (!userValidation.isValid) {
        errors.push(...userValidation.errors.map(err => `user.${err}`));
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Sanitize data by removing sensitive information
   */
  sanitizeData(data, sensitiveFields = ['password', 'token', 'secret', 'key', 'auth']) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeData(value, sensitiveFields);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Deep clone object
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }

    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }

    return cloned;
  }

  /**
   * Format error with additional context
   */
  formatError(error, context = {}) {
    const errorInfo = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      context: this.sanitizeData(context)
    };

    // Add HTTP status info if available
    if (error.response) {
      errorInfo.httpStatus = error.response.status;
      errorInfo.httpData = error.response.data;
    }

    // Add request info if available
    if (error.config) {
      errorInfo.request = {
        method: error.config.method,
        url: error.config.url,
        headers: this.sanitizeData(error.config.headers)
      };
    }

    return errorInfo;
  }

  /**
   * Retry function with exponential backoff
   */
  async retry(fn, options = {}) {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      backoffFactor = 2,
      onError = null
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (onError) {
          onError(error, attempt);
        }

        if (attempt === maxAttempts) {
          break;
        }

        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await this.sleep(delay);
        delay = Math.min(delay * backoffFactor, maxDelay);
      }
    }

    throw lastError;
  }

  /**
   * Sleep for specified milliseconds
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone format (basic validation)
   */
  isValidPhone(phone) {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  /**
   * Validate URL format
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Throttle function execution
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Debounce function execution
   */
  debounce(func, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Get system information
   */
  getSystemInfo() {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    };
  }

  /**
   * Safe JSON parse with error handling
   */
  safeJsonParse(str, defaultValue = null) {
    try {
      return JSON.parse(str);
    } catch (error) {
      console.warn('JSON parse failed:', error.message);
      return defaultValue;
    }
  }

  /**
   * Safe JSON stringify with error handling
   */
  safeJsonStringify(obj, defaultValue = '{}') {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      console.warn('JSON stringify failed:', error.message);
      return defaultValue;
    }
  }

  /**
   * Mask sensitive data in strings
   */
  maskSensitiveData(str, pattern = /(\w{4})(\w+)(\w{4})/g, replacement = '$1****$3') {
    if (typeof str !== 'string') {
      return str;
    }
    return str.replace(pattern, replacement);
  }

  /**
   * Check if object is empty
   */
  isEmpty(obj) {
    if (obj == null) return true;
    if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
  }

  /**
   * Merge objects deeply
   */
  deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (this.isObject(target) && this.isObject(source)) {
      for (const key in source) {
        if (this.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          this.deepMerge(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }

    return this.deepMerge(target, ...sources);
  }

  /**
   * Check if value is object
   */
  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
}

const utils = new UtilitiesModule();

export default utils;