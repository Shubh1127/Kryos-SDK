const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Mock SDK for testing - simulates sending data to Kryos backend
class MockKryosSDK {
  constructor(config) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'http://localhost:5000/api';
    this.keyId = config.keyId;
    this.keySecret = config.keySecret;
  }

  static init(config) {
    return new MockKryosSDK(config);
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/data/health`, {
        headers: {
          'Authorization': `Bearer ${this.keyId}.${this.keySecret}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Connection to Kryos backend successful');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to connect to Kryos backend:', error.message);
      throw error;
    }
  }

  async sendUserData(userData) {
    try {
      const response = await axios.post(`${this.baseUrl}/data/users`, userData, {
        headers: {
          'Authorization': `Bearer ${this.keyId}.${this.keySecret}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ User data sent successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to send user data:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendEntryData(entryData) {
    try {
      const response = await axios.post(`${this.baseUrl}/data/entries`, entryData, {
        headers: {
          'Authorization': `Bearer ${this.keyId}.${this.keySecret}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Entry data sent successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to send entry data:', error.response?.data || error.message);
      throw error;
    }
  }

  getRequestLogger() {
    return (req, res, next) => {
      console.log(`📝 ${req.method} ${req.path} - ${new Date().toISOString()}`);
      next();
    };
  }

  getMetricsMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`📊 ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
      });
      next();
    };
  }
}

// Initialize SDK
const kryos = MockKryosSDK.init({
  keyId: process.env.KRYOS_KEY_ID || 'demo_key_id',
  keySecret: process.env.KRYOS_KEY_SECRET || 'demo_key_secret',
  baseUrl: process.env.KRYOS_BASE_URL || 'http://localhost:5000/api'
});

// Add middleware
app.use(kryos.getRequestLogger());
app.use(kryos.getMetricsMiddleware());

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Kryos SDK Test Server',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      'POST /register': 'Register a user',
      'POST /event': 'Send an event',
      'GET /test-connection': 'Test Kryos connection'
    }
  });
});

// Test connection endpoint
app.get('/test-connection', async (req, res) => {
  try {
    const result = await kryos.testConnection();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Register user endpoint
app.post('/register', async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    const userData = {
      externalId: `user_${Date.now()}`,
      name,
      email,
      phone,
      metadata: {
        source: 'test_sdk',
        timestamp: new Date().toISOString()
      }
    };

    const result = await kryos.sendUserData(userData);
    
    res.json({ 
      success: true, 
      message: 'User registered and sent to Kryos',
      data: result 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Send event endpoint
app.post('/event', async (req, res) => {
  try {
    const { eventType, data, userId } = req.body;
    
    const entryData = {
      externalId: `event_${Date.now()}`,
      dataType: 'event_data',
      data: {
        event: eventType,
        ...data,
        timestamp: new Date().toISOString()
      },
      tags: ['test', eventType]
    };

    if (userId) {
      entryData.user = {
        externalId: userId
      };
    }

    const result = await kryos.sendEntryData(entryData);
    
    res.json({ 
      success: true, 
      message: 'Event sent to Kryos',
      data: result 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log('\n🚀 Kryos SDK Test Server Started!');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🎯 Backend: http://localhost:5000/api`);
  console.log('\n📋 Available Endpoints:');
  console.log(`   GET  /                - Server info`);
  console.log(`   GET  /test-connection - Test Kryos connection`);
  console.log(`   POST /register        - Register user`);
  console.log(`   POST /event           - Send event`);
  console.log('\n=====================================\n');
  
  // Test connection on startup
  try {
    await kryos.testConnection();
  } catch (error) {
    console.log('⚠️  Could not connect to Kryos backend. Make sure it\'s running on port 5000');
  }
});