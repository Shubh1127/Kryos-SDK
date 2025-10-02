/**
 * Kryos SDK - API Module
 * 
 * Handles all HTTP communications with the Kryos backend API.
 * Provides functions to send user data, entries, metrics, and files.
 */

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

class APIModule {
  constructor() {
    this.config = null;
    this.httpClient = null;
    this.isInitialized = false;
  }

  /**
   * Initialize API module with configuration
   */
  init(config) {
    this.config = config;
    this.isInitialized = true;

    // Create HTTP client with default configuration
    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: config.getDefaultHeaders()
    });

    // Add request interceptor for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        if (this.config.enableLogging) {
          console.log(`🔗 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        }
        return config;
      },
      (error) => {
        console.error('🔗 API Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging and error handling
    this.httpClient.interceptors.response.use(
      (response) => {
        if (this.config.enableLogging) {
          console.log(`✅ API Response: ${response.status} ${response.config.url}`);
        }
        return response;
      },
      (error) => {
        console.error(`❌ API Error: ${error.response?.status} ${error.config?.url}`, error.response?.data);
        return Promise.reject(this.formatError(error));
      }
    );

    console.log('🔗 Kryos API module initialized');
    return this;
  }

  /**
   * Format error for consistent error handling
   */
  formatError(error) {
    if (error.response) {
      // Server responded with error status
      return new Error(`API Error (${error.response.status}): ${error.response.data?.error || error.message}`);
    } else if (error.request) {
      // Request made but no response received
      return new Error(`Network Error: ${error.message}`);
    } else {
      // Something else happened
      return new Error(`Request Error: ${error.message}`);
    }
  }

  /**
   * Retry mechanism for failed requests
   */
  async retryRequest(requestFn, maxRetries = null) {
    const retries = maxRetries || this.config.retryAttempts;
    const delay = this.config.retryDelay;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        
        console.warn(`🔄 API request failed, retrying (${attempt}/${retries}) in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck() {
    return await this.retryRequest(async () => {
      const response = await this.httpClient.get('/data/health');
      return response.data;
    });
  }

  /**
   * Send user data to Kryos backend
   */
  async sendUserData(userData, files = []) {
    if (!userData || !userData.externalId) {
      throw new Error('User data must include externalId');
    }

    return await this.retryRequest(async () => {
      if (files && files.length > 0) {
        // Send with files using multipart/form-data
        return await this.sendWithFiles('/data/users', userData, files);
      } else {
        // Send JSON data
        const response = await this.httpClient.post('/data/users', userData);
        return response.data;
      }
    });
  }

  /**
   * Send data entry to Kryos backend
   */
  async sendEntryData(entryData, files = []) {
    if (!entryData || !entryData.externalId || !entryData.dataType) {
      throw new Error('Entry data must include externalId and dataType');
    }

    return await this.retryRequest(async () => {
      if (files && files.length > 0) {
        // Send with files using multipart/form-data
        return await this.sendWithFiles('/data/entries', entryData, files);
      } else {
        // Send JSON data
        const response = await this.httpClient.post('/data/entries', entryData);
        return response.data;
      }
    });
  }

  /**
   * Send metrics data to Kryos backend
   */
  async sendMetrics(metricsData) {
    if (!metricsData) {
      throw new Error('Metrics data is required');
    }

    const payload = {
      externalId: `metrics_${Date.now()}`,
      dataType: 'custom_data',
      data: {
        type: 'system_metrics',
        metrics: metricsData,
        timestamp: new Date().toISOString(),
        service: this.config.getServiceMetadata()
      },
      tags: ['metrics', 'monitoring', 'system']
    };

    return await this.retryRequest(async () => {
      const response = await this.httpClient.post('/data/entries', payload);
      return response.data;
    });
  }

  /**
   * Send custom event data
   */
  async sendEvent(eventData) {
    if (!eventData || !eventData.eventType) {
      throw new Error('Event data must include eventType');
    }

    const payload = {
      externalId: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dataType: 'event_data',
      data: {
        ...eventData,
        timestamp: eventData.timestamp || new Date().toISOString(),
        service: this.config.serviceName
      },
      tags: ['event', eventData.eventType]
    };

    return await this.retryRequest(async () => {
      const response = await this.httpClient.post('/data/entries', payload);
      return response.data;
    });
  }

  /**
   * Send error report
   */
  async sendError(errorData) {
    if (!errorData || !errorData.message) {
      throw new Error('Error data must include message');
    }

    const payload = {
      externalId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dataType: 'custom_data',
      data: {
        type: 'error_report',
        error: {
          message: errorData.message,
          stack: errorData.stack,
          code: errorData.code,
          severity: errorData.severity || 'error',
          timestamp: new Date().toISOString(),
          service: this.config.serviceName,
          version: this.config.serviceVersion,
          environment: this.config.environment,
          context: errorData.context || {}
        }
      },
      tags: ['error', 'monitoring', errorData.severity || 'error']
    };

    return await this.retryRequest(async () => {
      const response = await this.httpClient.post('/data/entries', payload);
      return response.data;
    });
  }

  /**
   * Send data with files using multipart/form-data
   */
  async sendWithFiles(endpoint, data, filePaths) {
    const formData = new FormData();

    // Add form fields
    this.flattenAndAddToForm(formData, data);

    // Add files
    for (const filePath of filePaths) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileStream = fs.createReadStream(filePath);
      const fileName = path.basename(filePath);
      formData.append('files', fileStream, fileName);
    }

    // Create request with form data headers
    const response = await this.httpClient.post(endpoint, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': this.config.getAuthHeader() // Ensure auth header is included
      }
    });

    return response.data;
  }

  /**
   * Flatten nested objects for form data
   */
  flattenAndAddToForm(formData, obj, prefix = '') {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const formKey = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Recursive call for nested objects
          this.flattenAndAddToForm(formData, value, formKey);
        } else if (Array.isArray(value)) {
          // Handle arrays
          value.forEach((item, index) => {
            if (typeof item === 'object') {
              this.flattenAndAddToForm(formData, item, `${formKey}[${index}]`);
            } else {
              formData.append(`${formKey}[${index}]`, item);
            }
          });
        } else {
          // Add primitive values
          formData.append(formKey, value);
        }
      }
    }
  }

  /**
   * Get user data from Kryos
   */
  async getUsers(page = 1, limit = 10) {
    return await this.retryRequest(async () => {
      const response = await this.httpClient.get('/data/users', {
        params: { page, limit }
      });
      return response.data;
    });
  }

  /**
   * Get data entries from Kryos
   */
  async getEntries(filters = {}) {
    const { page = 1, limit = 10, dataType, tags } = filters;
    
    return await this.retryRequest(async () => {
      const params = { page, limit };
      if (dataType) params.dataType = dataType;
      if (tags) params.tags = Array.isArray(tags) ? tags.join(',') : tags;

      const response = await this.httpClient.get('/data/entries', { params });
      return response.data;
    });
  }

  /**
   * Get files from Kryos
   */
  async getFiles(filters = {}) {
    const { page = 1, limit = 10, mimetype } = filters;
    
    return await this.retryRequest(async () => {
      const params = { page, limit };
      if (mimetype) params.mimetype = mimetype;

      const response = await this.httpClient.get('/data/files', { params });
      return response.data;
    });
  }

  /**
   * Batch send multiple data entries
   */
  async batchSendEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error('Entries must be a non-empty array');
    }

    const results = [];
    const batchSize = 10; // Process in batches to avoid overwhelming the API

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const batchPromises = batch.map(entry => this.sendEntryData(entry));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, error);
        results.push(...batch.map(() => ({ status: 'rejected', reason: error })));
      }
    }

    return results;
  }
}

const api = new APIModule();

export default api;