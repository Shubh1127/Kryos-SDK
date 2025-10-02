const express = require('express');
const KryosSDK = require('../index');

const app = express();
app.use(express.json());

// Initialize Kryos SDK for e-commerce
const kryos = KryosSDK.init({
  keyId: process.env.KRYOS_KEY_ID || 'ecommerce_key_id',
  keySecret: process.env.KRYOS_KEY_SECRET || 'ecommerce_key_secret',
  baseUrl: process.env.KRYOS_BASE_URL || 'http://localhost:5000/api',
  serviceName: 'ecommerce-backend',
  serviceVersion: '2.1.0',
  customTags: {
    environment: 'production',
    service_type: 'ecommerce'
  }
});

// Add Kryos middleware
app.use(kryos.getRequestLogger());
app.use(kryos.getMetricsMiddleware());
app.use(kryos.middleware.userActivityTracker());

// Create custom metrics
const orderCounter = kryos.monitoring.createCounter(
  'orders_total',
  'Total number of orders processed'
);

const revenueGauge = kryos.monitoring.createGauge(
  'revenue_total',
  'Total revenue generated'
);

const inventoryGauge = kryos.monitoring.createGauge(
  'inventory_items',
  'Current inventory count',
  ['product_category']
);

// Mock data
const products = [
  { id: 'prod_1', name: 'Laptop', price: 999, category: 'electronics', stock: 50 },
  { id: 'prod_2', name: 'Phone', price: 599, category: 'electronics', stock: 30 },
  { id: 'prod_3', name: 'Book', price: 29, category: 'books', stock: 100 }
];

const users = new Map();
let totalRevenue = 0;

// Routes
app.get('/api/products', (req, res) => {
  // Update inventory metrics
  products.forEach(product => {
    inventoryGauge.set({ product_category: product.category }, product.stock);
  });
  
  res.json(products);
});

app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store user
    users.set(userId, { userId, name, email, phone, address, createdAt: new Date() });
    
    // Send user data to Kryos
    await kryos.sendUserData({
      externalId: userId,
      name,
      email,
      phone,
      metadata: {
        signupDate: new Date().toISOString(),
        address,
        source: 'ecommerce_registration',
        userAgent: req.get('User-Agent')
      }
    });
    
    // Send registration event
    await kryos.sendEntryData({
      externalId: `user_reg_${userId}`,
      dataType: 'event_data',
      data: {
        event: 'user_registration',
        userId,
        timestamp: new Date().toISOString(),
        channel: 'web',
        ip: req.ip
      },
      tags: ['registration', 'user_lifecycle', 'ecommerce']
    });
    
    res.status(201).json({
      success: true,
      userId,
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { userId, items, shippingAddress, paymentMethod } = req.body;
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate order total
    let orderTotal = 0;
    const orderItems = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      
      const itemTotal = product.price * item.quantity;
      orderTotal += itemTotal;
      
      return {
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal
      };
    });
    
    // Update metrics
    orderCounter.inc();
    totalRevenue += orderTotal;
    revenueGauge.set(totalRevenue);
    
    // Send order data to Kryos
    await kryos.sendEntryData({
      externalId: orderId,
      dataType: 'event_data',
      data: {
        event: 'order_created',
        orderId,
        userId,
        orderTotal,
        items: orderItems,
        shippingAddress,
        paymentMethod,
        timestamp: new Date().toISOString(),
        currency: 'USD'
      },
      user: users.get(userId) || null,
      tags: ['order', 'purchase', 'ecommerce', 'revenue']
    });
    
    // Send individual item purchase events
    for (const item of orderItems) {
      await kryos.sendEntryData({
        externalId: `purchase_${orderId}_${item.productId}`,
        dataType: 'event_data',
        data: {
          event: 'product_purchased',
          orderId,
          userId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          revenue: item.totalPrice,
          timestamp: new Date().toISOString()
        },
        tags: ['product_purchase', 'item_sale', item.productId.split('_')[1]]
      });
    }
    
    // Send payment processing event
    await kryos.sendEntryData({
      externalId: `payment_${orderId}`,
      dataType: 'event_data',
      data: {
        event: 'payment_processed',
        orderId,
        userId,
        amount: orderTotal,
        paymentMethod,
        status: 'success',
        timestamp: new Date().toISOString(),
        processingTime: Math.random() * 2000 + 500 // Simulate processing time
      },
      tags: ['payment', 'transaction', 'success']
    });
    
    res.status(201).json({
      success: true,
      orderId,
      orderTotal,
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Order creation error:', error);
    
    // Send failed order event
    await kryos.sendEntryData({
      externalId: `order_fail_${Date.now()}`,
      dataType: 'event_data',
      data: {
        event: 'order_failed',
        userId: req.body.userId,
        error: error.message,
        timestamp: new Date().toISOString(),
        failureReason: 'processing_error'
      },
      tags: ['order', 'failure', 'error']
    });
    
    res.status(500).json({ success: false, message: 'Order creation failed' });
  }
});

app.post('/api/cart/add', async (req, res) => {
  try {
    const { userId, productId, quantity = 1 } = req.body;
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    // Send cart addition event
    await kryos.sendEntryData({
      externalId: `cart_add_${userId}_${productId}_${Date.now()}`,
      dataType: 'event_data',
      data: {
        event: 'cart_item_added',
        userId,
        productId,
        productName: product.name,
        quantity,
        price: product.price,
        timestamp: new Date().toISOString()
      },
      user: users.get(userId) || null,
      tags: ['cart', 'product_interaction', 'funnel']
    });
    
    res.json({
      success: true,
      message: 'Item added to cart',
      product: product.name,
      quantity
    });
  } catch (error) {
    console.error('Cart add error:', error);
    res.status(500).json({ success: false, message: 'Failed to add item to cart' });
  }
});

// Product view tracking
app.get('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.query.userId;
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    // Send product view event
    await kryos.sendEntryData({
      externalId: `view_${productId}_${Date.now()}`,
      dataType: 'event_data',
      data: {
        event: 'product_viewed',
        productId,
        productName: product.name,
        category: product.category,
        price: product.price,
        userId: userId || 'anonymous',
        timestamp: new Date().toISOString(),
        referrer: req.get('Referrer'),
        userAgent: req.get('User-Agent')
      },
      tags: ['product_view', 'funnel', product.category]
    });
    
    res.json(product);
  } catch (error) {
    console.error('Product view error:', error);
    res.status(500).json({ success: false, message: 'Failed to get product' });
  }
});

// Analytics endpoint
app.get('/api/analytics', async (req, res) => {
  try {
    const analytics = {
      totalOrders: orderCounter.get(),
      totalRevenue: totalRevenue,
      activeUsers: users.size,
      inventoryStatus: products.map(p => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        lowStock: p.stock < 20
      })),
      timestamp: new Date().toISOString()
    };
    
    // Send analytics request event
    await kryos.sendEntryData({
      externalId: `analytics_${Date.now()}`,
      dataType: 'event_data',
      data: {
        event: 'analytics_requested',
        data: analytics,
        timestamp: new Date().toISOString()
      },
      tags: ['analytics', 'dashboard', 'business_intelligence']
    });
    
    // Send custom metrics
    await kryos.sendMetrics({
      totalOrdersMetric: orderCounter.get(),
      totalRevenueMetric: totalRevenue,
      activeUsersMetric: users.size,
      lowStockItems: products.filter(p => p.stock < 20).length
    });
    
    res.json(analytics);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to get analytics' });
  }
});

// Simulate periodic inventory updates
setInterval(async () => {
  try {
    // Randomly update stock levels
    products.forEach(product => {
      const change = Math.floor(Math.random() * 10) - 5; // -5 to +5
      product.stock = Math.max(0, product.stock + change);
      inventoryGauge.set({ product_category: product.category }, product.stock);
    });
    
    // Send inventory update event
    await kryos.sendEntryData({
      externalId: `inventory_update_${Date.now()}`,
      dataType: 'event_data',
      data: {
        event: 'inventory_updated',
        products: products.map(p => ({ id: p.id, stock: p.stock })),
        timestamp: new Date().toISOString(),
        updateType: 'automated'
      },
      tags: ['inventory', 'automated', 'stock_management']
    });
  } catch (error) {
    console.error('Inventory update error:', error);
  }
}, 30000); // Every 30 seconds

// Health check with custom checks
app.get('/health', kryos.middleware.healthCheck([
  async () => ({
    name: 'inventory_service',
    status: products.every(p => p.stock >= 0) ? 'healthy' : 'unhealthy'
  }),
  async () => ({
    name: 'user_service',
    status: users.size >= 0 ? 'healthy' : 'unhealthy'
  })
]));

// Metrics endpoint
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

// Error handling
app.use(kryos.middleware.errorTracker());

const PORT = process.env.PORT || 3002;

app.listen(PORT, async () => {
  console.log(`\n🛒 E-commerce Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`📊 Analytics: http://localhost:${PORT}/api/analytics`);
  console.log('=====================================\n');
  
  try {
    await kryos.testConnection();
    console.log('✅ Kryos SDK connected successfully');
    
    // Initialize inventory metrics
    products.forEach(product => {
      inventoryGauge.set({ product_category: product.category }, product.stock);
    });
    
    // Send startup event
    await kryos.sendEntryData({
      externalId: `ecommerce_startup_${Date.now()}`,
      dataType: 'event_data',
      data: {
        event: 'service_startup',
        service: 'ecommerce-backend',
        version: '2.1.0',
        timestamp: new Date().toISOString(),
        port: PORT,
        initialProductCount: products.length
      },
      tags: ['startup', 'ecommerce', 'service']
    });
  } catch (error) {
    console.error('❌ Failed to connect to Kryos:', error.message);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down e-commerce backend...');
  
  try {
    await kryos.sendEntryData({
      externalId: `ecommerce_shutdown_${Date.now()}`,
      dataType: 'event_data',
      data: {
        event: 'service_shutdown',
        service: 'ecommerce-backend',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        totalOrders: orderCounter.get(),
        totalRevenue: totalRevenue
      },
      tags: ['shutdown', 'ecommerce', 'service']
    });
    
    await kryos.shutdown();
    console.log('✅ E-commerce backend shutdown complete');
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
  }
  
  process.exit(0);
});