const express = require('express');
const KryosSDK = require('../index');

const app = express();
app.use(express.json());

// Initialize Kryos SDK
const kryos = KryosSDK.init({
  keyId: process.env.KRYOS_KEY_ID || 'demo_key_id',
  keySecret: process.env.KRYOS_KEY_SECRET || 'demo_key_secret',
  baseUrl: process.env.KRYOS_BASE_URL || 'http://localhost:5000/api',
  serviceName: 'basic-express-demo',
  serviceVersion: '1.0.0'
});

// Add Kryos middleware
app.use(kryos.getRequestLogger());
app.use(kryos.getMetricsMiddleware());

// Basic routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Basic Express Demo with Kryos SDK',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// User registration endpoint
app.post('/register', async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    // Simulate user creation
    const userId = `user_${Date.now()}`;
    
    // Send user data to Kryos
    await kryos.sendUserData({
      externalId: userId,
      name,
      email,
      phone,
      metadata: {
        signupDate: new Date().toISOString(),
        source: 'registration_form',
        ipAddress: req.ip
      }
    });
    
    // Send registration event
    await kryos.sendEntryData({
      externalId: `reg_${userId}`,
      dataType: 'event_data',
      data: {
        event: 'user_registration',
        userId,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip
      },
      tags: ['registration', 'new_user']
    });
    
    res.status(201).json({
      success: true,
      userId,
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Simulate login logic
    const userId = `user_${Math.floor(Math.random() * 1000)}`;
    
    // Send login event
    await kryos.sendEntryData({
      externalId: `login_${Date.now()}`,
      dataType: 'event_data',
      data: {
        event: 'user_login',
        userId,
        email,
        timestamp: new Date().toISOString(),
        success: true,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      },
      tags: ['authentication', 'login', 'success']
    });
    
    res.json({
      success: true,
      userId,
      token: 'demo_jwt_token'
    });
  } catch (error) {
    console.error('Login error:', error);
    
    // Send failed login event
    await kryos.sendEntryData({
      externalId: `login_fail_${Date.now()}`,
      dataType: 'event_data',
      data: {
        event: 'user_login',
        email: req.body.email,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message,
        ip: req.ip
      },
      tags: ['authentication', 'login', 'failure']
    });
    
    res.status(401).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Custom metrics endpoint
app.get('/api/stats', async (req, res) => {
  try {
    // Send custom metrics
    await kryos.sendMetrics({
      activeUsers: Math.floor(Math.random() * 100) + 50,
      requestsToday: Math.floor(Math.random() * 1000) + 500,
      responseTime: Math.random() * 200 + 50
    });
    
    res.json({
      timestamp: new Date().toISOString(),
      activeUsers: 75,
      totalRequests: 1234,
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Health check endpoint
app.get('/health', kryos.middleware.healthCheck([
  // Custom health check
  async () => ({
    name: 'custom_service',
    status: Math.random() > 0.1 ? 'healthy' : 'unhealthy'
  })
]));

// Metrics endpoint (Prometheus format)
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await kryos.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).send('Failed to get metrics');
  }
});

// Error handling middleware
app.use(kryos.middleware.errorTracker());

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log(`\n🚀 Basic Express Demo Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  console.log('=====================================\n');
  
  try {
    // Test Kryos connection
    await kryos.testConnection();
    console.log('✅ Kryos SDK connected successfully');
    
    // Send startup event
    await kryos.sendEntryData({
      externalId: `startup_${Date.now()}`,
      dataType: 'event_data',
      data: {
        event: 'service_startup',
        service: 'basic-express-demo',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        port: PORT
      },
      tags: ['startup', 'service']
    });
  } catch (error) {
    console.error('❌ Failed to connect to Kryos:', error.message);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  try {
    // Send shutdown event
    await kryos.sendEntryData({
      externalId: `shutdown_${Date.now()}`,
      dataType: 'event_data',
      data: {
        event: 'service_shutdown',
        service: 'basic-express-demo',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      },
      tags: ['shutdown', 'service']
    });
    
    await kryos.shutdown();
    console.log('✅ Kryos SDK shutdown complete');
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
  }
  
  process.exit(0);
});