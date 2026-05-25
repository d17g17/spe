require('dotenv').config(); // Load environment variables first
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { initializeDatabase } = require('./src/dbInit'); // Import the initializer
const profileRoutes = require('./src/routes/profileRoutes');
const cs2InventoryRoutes = require('./src/routes/cs2InventoryRoutes');
const itemPriceRoutes = require('./src/routes/itemPriceRoutes');
const healthRoutes = require('./src/routes/healthRoutes');
const logger = require('./src/utils/logger');
const webSocketService = require('./src/services/WebSocketService');
const {
  compressionMiddleware,
  requestDeduplicationMiddleware,
  responseTimeMiddleware,
  memoryMonitoringMiddleware,
  optimizedErrorHandler,
  cleanup: performanceCleanup
} = require('./src/middleware/performanceMiddleware');

logger.server.info('Application startup initiated', {
  nodeVersion: process.version,
  platform: process.platform,
  environment: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3002
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});
const PORT = process.env.PORT || 3002;

// Make io available to our routes
app.set('io', io);

// Middleware
logger.server.debug('Configuring Express middleware stack');

// Performance middleware
app.use(compressionMiddleware);
app.use(responseTimeMiddleware);
app.use(memoryMonitoringMiddleware);
app.use(requestDeduplicationMiddleware);

// Configure CORS with specific options
const corsOptions = {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions)); // Enable CORS with specific options
app.use(express.json({ limit: '50mb' })); // Parse JSON request bodies with increased size limit
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Parse URL-encoded bodies with increased size limit

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'debug';
    
    logger.http[logLevel](logger.helpers.request(
      req.method, 
      req.url, 
      res.statusCode, 
      duration
    ));
  });
  
  next();
});

// Routes
logger.server.debug('Mounting API route handlers');
app.use('/api/profiles', profileRoutes); // Mount profile routes under /api/profiles
app.use('/api', cs2InventoryRoutes); // Mount CS2 inventory routes under /api
app.use('/api/item-prices', itemPriceRoutes); // Mount item price routes under /api/item-prices
app.use('/api', healthRoutes); // Mount health routes under /api

// Direct health route for compatibility (redirects to /api/health)
app.get('/health', (req, res) => {
  res.redirect(301, '/api/health');
});

// Error handling middleware (must be last)
app.use(optimizedErrorHandler);

// Root route for API verification
app.get('/', (req, res) => {
  res.json({ message: 'Steam Profile App API is running' });
});

// Start server function
const startServer = async () => {
  logger.server.info('Initializing server components');
  try {
    // Initialize Database (Create DB if not exists & Run Migrations)
    logger.database.info('Starting database initialization');
    await initializeDatabase();
    logger.database.success('Database initialization completed successfully');

    // Initialize WebSocket service with our Socket.io instance
    logger.websocket.info('Initializing WebSocket service');
    webSocketService.initialize(io);
    logger.websocket.success('WebSocket service initialized successfully');
    
    // Set up periodic server status broadcast (every 30 seconds)
    const serverStatusInterval = setInterval(() => {
      webSocketService.broadcastServerStatus();
    }, 30000); // 30 seconds interval
    
    // Handle process termination
    process.on('SIGTERM', () => {
      logger.system.warn('SIGTERM signal received - initiating graceful shutdown');
      performanceCleanup();
      clearInterval(serverStatusInterval);
      server.close(() => {
        logger.system.info('HTTP server closed successfully');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.system.warn('SIGINT signal received - initiating graceful shutdown');
      performanceCleanup();
      clearInterval(serverStatusInterval);
      server.close(() => {
        logger.system.info('HTTP server closed successfully');
        process.exit(0);
      });
    });

    // Start listening only after DB is ready and Socket.io is set up
    server.listen(PORT, () => {
      logger.server.success(`HTTP server started successfully`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        apiEndpoint: `http://localhost:${PORT}/api/profiles`,
        websocketEnabled: true
      });
      
      if (process.env.STEAM_API_KEY) {
        logger.steam.success('Steam API integration configured with valid API key');
      } else {
        logger.steam.warn('Steam API integration running without API key - add STEAM_API_KEY to environment');
      }
      
      logger.system.success('Application startup completed - ready to accept connections');
    });

  } catch (error) {
    logger.system.fatal('Application startup failed', {
      error: logger.helpers.error(error),
      stage: 'initialization'
    }); 
    process.exit(1); // Exit if database initialization fails
  }
};

// Run the server startup
startServer();