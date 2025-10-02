# Kryos SDK Examples

This directory contains complete working examples of how to integrate the Kryos SDK into different types of Node.js applications.

## Available Examples

### 1. Basic Express App (`basic-express.js`)
A simple Express.js application demonstrating:
- Basic SDK setup and initialization
- User registration and login tracking
- Custom metrics collection
- Request logging and monitoring
- Health checks and graceful shutdown

**Features:**
- User registration with data tracking
- Login events with success/failure tracking
- Custom metrics endpoint
- Prometheus metrics exposure
- Error handling and reporting

**Run the example:**
```bash
cd examples
node basic-express.js
```

Access endpoints:
- http://localhost:3001 - Main endpoint
- http://localhost:3001/health - Health check
- http://localhost:3001/metrics - Prometheus metrics

### 2. E-commerce Backend (`ecommerce-backend.js`)
A comprehensive e-commerce backend showcasing:
- Product catalog management
- Order processing and tracking
- Cart functionality
- Revenue and inventory metrics
- Advanced event tracking

**Features:**
- User registration and management
- Product viewing and cart interactions
- Order creation with detailed tracking
- Payment processing events
- Inventory management with automated updates
- Business analytics and custom metrics
- Real-time stock level monitoring

**Run the example:**
```bash
cd examples
node ecommerce-backend.js
```

Access endpoints:
- http://localhost:3002/api/products - Product catalog
- http://localhost:3002/api/analytics - Business analytics
- http://localhost:3002/health - Health check
- http://localhost:3002/metrics - Metrics

## Prerequisites

Before running the examples, make sure you have:

1. **Kryos Backend Running**: The examples connect to your Kryos backend API
2. **API Credentials**: Set up your API key and secret
3. **Dependencies**: Install the required packages

### Setup Instructions

1. **Install Dependencies**:
   ```bash
   cd ../  # Go back to SDK root
   npm install
   cd examples/
   ```

2. **Configure Environment** (Optional):
   Create a `.env` file in the examples directory:
   ```env
   KRYOS_KEY_ID=your_actual_key_id
   KRYOS_KEY_SECRET=your_actual_key_secret
   KRYOS_BASE_URL=http://localhost:5000/api
   PORT=3001
   ```

3. **Start Your Kryos Backend**:
   ```bash
   # In another terminal, from the root Kryos directory
   cd backend
   npm run dev
   ```

4. **Run an Example**:
   ```bash
   # Basic Express example
   node basic-express.js
   
   # Or E-commerce example
   node ecommerce-backend.js
   ```

## Testing the Examples

### Basic Express App Testing

1. **Register a User**:
   ```bash
   curl -X POST http://localhost:3001/register \
     -H "Content-Type: application/json" \
     -d '{
       "name": "John Doe",
       "email": "john@example.com",
       "phone": "+1-555-0123"
     }'
   ```

2. **Login**:
   ```bash
   curl -X POST http://localhost:3001/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "john@example.com",
       "password": "password123"
     }'
   ```

3. **Check Metrics**:
   ```bash
   curl http://localhost:3001/metrics
   ```

### E-commerce Backend Testing

1. **Register a User**:
   ```bash
   curl -X POST http://localhost:3002/api/users/register \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Jane Smith",
       "email": "jane@example.com",
       "phone": "+1-555-0124",
       "address": "123 Main St, City, State"
     }'
   ```

2. **View Products**:
   ```bash
   curl http://localhost:3002/api/products
   ```

3. **Add to Cart**:
   ```bash
   curl -X POST http://localhost:3002/api/cart/add \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "user_1234567890",
       "productId": "prod_1",
       "quantity": 2
     }'
   ```

4. **Create Order**:
   ```bash
   curl -X POST http://localhost:3002/api/orders \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "user_1234567890",
       "items": [
         {"productId": "prod_1", "quantity": 1},
         {"productId": "prod_2", "quantity": 2}
       ],
       "shippingAddress": "123 Main St, City, State",
       "paymentMethod": "credit_card"
     }'
   ```

5. **Check Analytics**:
   ```bash
   curl http://localhost:3002/api/analytics
   ```

## What Each Example Demonstrates

### SDK Features Shown in Basic Express:
- ✅ SDK initialization and configuration
- ✅ User data tracking (`sendUserData`)
- ✅ Event tracking (`sendEntryData`)
- ✅ Custom metrics (`sendMetrics`)
- ✅ Request logging middleware
- ✅ Metrics collection middleware
- ✅ Error tracking
- ✅ Health checks
- ✅ Graceful shutdown

### Additional Features in E-commerce Example:
- ✅ Custom Prometheus metrics (counters, gauges)
- ✅ Complex event tracking (orders, payments, inventory)
- ✅ User activity tracking middleware
- ✅ Batch data processing
- ✅ Real-time metrics updates
- ✅ Business intelligence events
- ✅ Advanced error handling
- ✅ Automated background processes

## Monitoring Your Examples

Once running, you can monitor your examples through:

1. **Kryos Dashboard**: View all tracked data in your main Kryos dashboard
2. **Prometheus Metrics**: Access `/metrics` endpoint for raw metrics
3. **Health Checks**: Monitor service health via `/health` endpoint
4. **Console Logs**: Check terminal output for SDK activity
5. **Error Tracking**: Automatic error reporting to Kryos

## Customization

Feel free to modify these examples to match your specific use case:

- **Add Custom Events**: Create events specific to your business logic
- **Custom Metrics**: Add metrics that matter to your application
- **Middleware**: Implement custom middleware for your needs
- **Error Handling**: Extend error tracking for your specific errors
- **Data Structure**: Modify data structures to match your schema

## Production Considerations

When adapting these examples for production:

1. **Environment Variables**: Use proper environment variable management
2. **Error Handling**: Implement comprehensive error handling
3. **Logging**: Add proper logging (Winston, Bunyan, etc.)
4. **Security**: Implement proper authentication and authorization
5. **Rate Limiting**: Add rate limiting for API endpoints
6. **Input Validation**: Validate all incoming data
7. **Database**: Replace mock data with real database connections
8. **Monitoring**: Set up proper monitoring and alerting

## Troubleshooting

Common issues and solutions:

1. **Connection Errors**: Ensure your Kryos backend is running
2. **Authentication Errors**: Verify your API key and secret
3. **Port Conflicts**: Change the PORT environment variable
4. **Missing Dependencies**: Run `npm install` in the SDK root directory

## Support

If you encounter issues with these examples:
- Check the main README for troubleshooting
- Verify your Kryos backend is properly configured
- Ensure your API keys are valid
- Check console logs for detailed error messages