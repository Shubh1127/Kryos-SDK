# Kryos SDK for Node.js

Official Node.js SDK for Kryos - Monitor backend metrics and send data to your Kryos dashboard.

## Features

🔧 **Easy Integration** - Simple setup with API key authentication  
📊 **Monitoring** - Automatic collection of Node.js metrics using Prometheus  
🚀 **Data Submission** - Send user data, events, and files to Kryos backend  
⚡ **Express Middleware** - Automatic request logging and metrics collection  
🛡️ **Error Tracking** - Automatic error reporting and handling  
🎯 **Customizable** - Flexible configuration and custom metrics support  

## Installation

```bash
npm install kryos-sdk
```

## Quick Start

```javascript
import KryosSDK from 'kryos-sdk';

// Initialize the SDK
const kryos = KryosSDK.init({
  keyId: 'your_key_id',
  keySecret: 'your_key_secret',
  baseUrl: 'http://localhost:5000/api', // Your Kryos backend URL
  serviceName: 'my-awesome-service',
  serviceVersion: '1.0.0'
});

// Test connection
await kryos.testConnection();

// Send user data
await kryos.sendUserData({
  externalId: 'user_123',
  name: 'John Doe',
  email: 'john@example.com',
  metadata: { source: 'api', tier: 'premium' }
});

// Send custom event
await kryos.sendEntryData({
  externalId: 'purchase_456',
  dataType: 'event_data',
  data: {
    event: 'purchase',
    amount: 99.99,
    productId: 'prod_123'
  },
  tags: ['purchase', 'conversion']
});
```

## Express Integration

```javascript
import express from 'express';
import KryosSDK from 'kryos-sdk';

const app = express();
const kryos = KryosSDK.init({ /* config */ });

// Add request logging middleware
app.use(kryos.getRequestLogger());

// Add metrics collection middleware
app.use(kryos.getMetricsMiddleware());

// Add error tracking
app.use(kryos.middleware.errorTracker());

// Health check endpoint
app.get('/health', kryos.middleware.healthCheck());

// Your routes...
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Configuration

### Environment Variables

```bash
KRYOS_KEY_ID=your_key_id
KRYOS_KEY_SECRET=your_key_secret
KRYOS_BASE_URL=http://localhost:5000/api
KRYOS_SERVICE_NAME=my-service
KRYOS_SERVICE_VERSION=1.0.0
KRYOS_ENABLE_METRICS=true
KRYOS_ENABLE_LOGGING=true
```

### Configuration Options

```javascript
const kryos = KryosSDK.init({
  // Required
  keyId: 'your_key_id',
  keySecret: 'your_key_secret',
  
  // Optional
  baseUrl: 'http://localhost:5000/api',
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
  environment: 'production',
  enableDefaultMetrics: true,
  enableLogging: true,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  customTags: {
    team: 'backend',
    region: 'us-east-1'
  }
});
```

## API Reference

### Core Methods

#### `sendUserData(userData, files?)`
Send user information to Kryos.

```javascript
await kryos.sendUserData({
  externalId: 'user_123',
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+1-555-0123',
  metadata: {
    signupDate: '2024-01-15',
    plan: 'premium'
  }
}, ['profile-image.jpg']); // Optional files
```

#### `sendEntryData(entryData, files?)`
Send custom data entries and events.

```javascript
await kryos.sendEntryData({
  externalId: 'event_456',
  dataType: 'event_data', // 'user_data', 'event_data', 'custom_data'
  data: {
    event: 'user_login',
    timestamp: new Date().toISOString(),
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0...'
  },
  tags: ['authentication', 'login']
});
```

#### `sendMetrics(customMetrics?)`
Send system and custom metrics.

```javascript
await kryos.sendMetrics({
  activeUsers: 150,
  queueSize: 25,
  customMetric: 42
});
```

### Monitoring

#### `getMetrics()`
Get current metrics in Prometheus format.

```javascript
const prometheusMetrics = await kryos.getMetrics();
console.log(prometheusMetrics);
```

#### Custom Metrics

```javascript
// Create custom counter
const orderCounter = kryos.monitoring.createCounter(
  'orders_total',
  'Total number of orders'
);

// Increment counter
orderCounter.inc();

// Create custom gauge
const activeUsersGauge = kryos.monitoring.createGauge(
  'active_users',
  'Number of active users'
);

// Set gauge value
activeUsersGauge.set(150);
```

### Middleware

#### Request Logger
```javascript
app.use(kryos.getRequestLogger());
```

#### Metrics Collector
```javascript
app.use(kryos.getMetricsMiddleware());
```

#### Error Tracker
```javascript
app.use(kryos.middleware.errorTracker());
```

#### User Activity Tracker
```javascript
app.use(kryos.middleware.userActivityTracker());
```

#### Health Check
```javascript
app.get('/health', kryos.middleware.healthCheck([
  // Custom health checks
  async () => ({
    name: 'database',
    status: await checkDatabase() ? 'healthy' : 'unhealthy'
  })
]));
```

### Utilities

```javascript
// Generate unique ID
const id = kryos.utils.generateUniqueId('order');

// Validate data
const validation = kryos.utils.validateUserData(userData);
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
}

// Generate hash
const hash = kryos.utils.generateHash(sensitiveData);

// Sanitize data
const sanitized = kryos.utils.sanitizeData(data);

// Retry function
await kryos.utils.retry(
  async () => await riskyOperation(),
  { maxAttempts: 3, initialDelay: 1000 }
);
```

## Error Handling

The SDK automatically handles errors and provides detailed error information:

```javascript
try {
  await kryos.sendUserData(userData);
} catch (error) {
  console.error('Failed to send user data:', error.message);
  
  // Error details are automatically sent to Kryos
  // You can also manually send errors
  await kryos.api.sendError({
    message: error.message,
    stack: error.stack,
    context: { userId: 'user_123' }
  });
}
```

## Data Types

### User Data Structure
```javascript
{
  externalId: 'string (required)',
  name: 'string (required)',
  email: 'string (required)',
  phone: 'string (optional)',
  metadata: {} // object (optional)
}
```

### Entry Data Structure
```javascript
{
  externalId: 'string (required)',
  dataType: 'user_data|event_data|custom_data (required)',
  data: {}, // object (required)
  user: {}, // user object (optional)
  tags: [] // array of strings (optional)
}
```

## File Uploads

Send files along with your data:

```javascript
// With user data
await kryos.sendUserData(userData, [
  'profile-image.jpg',
  'document.pdf'
]);

// With entry data
await kryos.sendEntryData(entryData, [
  'screenshot.png',
  'log-file.txt'
]);
```

## Advanced Usage

### Custom Monitoring

```javascript
// Create custom metrics
const responseTimeHistogram = kryos.monitoring.createHistogram(
  'response_time_seconds',
  'Response time in seconds',
  ['endpoint', 'method']
);

// Use in your routes
app.get('/api/slow-endpoint', (req, res) => {
  const startTime = Date.now();
  
  // Your logic here
  
  const duration = (Date.now() - startTime) / 1000;
  responseTimeHistogram.observe(
    { endpoint: '/api/slow-endpoint', method: 'GET' },
    duration
  );
  
  res.json({ result: 'success' });
});
```

### Batch Operations

```javascript
// Send multiple entries at once
const entries = [
  { externalId: 'event_1', dataType: 'event_data', data: {...} },
  { externalId: 'event_2', dataType: 'event_data', data: {...} },
  { externalId: 'event_3', dataType: 'event_data', data: {...} }
];

const results = await kryos.api.batchSendEntries(entries);
console.log('Batch results:', results);
```

### Graceful Shutdown

```javascript
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await kryos.shutdown();
  process.exit(0);
});
```

## Examples

Check out the `examples/` directory for complete implementation examples:

- [Basic Express App](examples/basic-express.js)
- [E-commerce Backend](examples/ecommerce-backend.js)
- [API Gateway](examples/api-gateway.js)

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   ```
   API Error (401): Invalid or expired API key
   ```
   - Verify your `keyId` and `keySecret`
   - Check that your API key hasn't expired
   - Ensure the API key has the correct permissions

2. **Connection Errors**
   ```
   Network Error: connect ECONNREFUSED
   ```
   - Verify the `baseUrl` is correct
   - Check that the Kryos backend is running
   - Verify network connectivity

3. **Validation Errors**
   ```
   API Error (400): externalId is required
   ```
   - Check the data structure matches the expected format
   - Use `kryos.utils.validateUserData()` or `kryos.utils.validateEntryData()`

### Debug Mode

Enable verbose logging:

```javascript
const kryos = KryosSDK.init({
  // ... other config
  enableLogging: true
});
```

Or set environment variable:
```bash
KRYOS_ENABLE_LOGGING=true
```

## Support

- 📖 [Documentation](https://github.com/your-repo/kryos-sdk)
- 🐛 [Report Issues](https://github.com/your-repo/kryos-sdk/issues)
- 💬 [Discussions](https://github.com/your-repo/kryos-sdk/discussions)

## License

MIT License - see [LICENSE](LICENSE) file for details.