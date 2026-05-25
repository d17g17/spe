/**
 * Performance Middleware
 * Implements various performance optimizations for the Express server
 */
const compression = require('compression');
const logger = require('../utils/logger');

// Request deduplication cache to prevent duplicate API calls
const requestCache = new Map();
const CACHE_TTL = 5000; // 5 seconds

/**
 * Compression middleware for response optimization
 */
const compressionMiddleware = compression({
  // Only compress responses larger than 1KB
  threshold: 1024,
  // Compression level (1-9, 6 is default)
  level: 6,
  // Filter function to determine what to compress
  filter: (req, res) => {
    // Don't compress if the request includes a cache-control: no-transform directive
    if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
      return false;
    }
    // Use compression filter function
    return compression.filter(req, res);
  }
});

/**
 * Request deduplication middleware to prevent duplicate API calls
 */
const requestDeduplicationMiddleware = (req, res, next) => {
  // Only apply to GET requests for API endpoints
  if (req.method !== 'GET' || !req.path.startsWith('/api/')) {
    return next();
  }

  const cacheKey = `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
  const now = Date.now();

  // Check if there's a pending request for the same resource
  const cachedRequest = requestCache.get(cacheKey);
  if (cachedRequest && (now - cachedRequest.timestamp) < CACHE_TTL) {
    // If there's a pending promise, wait for it
    if (cachedRequest.promise) {
      return cachedRequest.promise.then(result => {
        res.json(result);
      }).catch(error => {
        res.status(500).json({ error: error.message });
      });
    }
  }

  // Create a promise for this request
  const requestPromise = new Promise((resolve, reject) => {
    // Store original res.json to capture the response
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      resolve(data);
      return originalJson(data);
    };

    // Store original res.status but don't interfere with error responses
    const originalStatus = res.status.bind(res);
    res.status = function(code) {
      if (code >= 400) {
        // Don't reject on error status codes, let them be handled normally
        requestCache.delete(cacheKey);
      }
      return originalStatus(code);
    };

    next();
  });

  // Cache the request
  requestCache.set(cacheKey, {
    timestamp: now,
    promise: requestPromise
  });

  // Clean up cache entry after TTL
  setTimeout(() => {
    requestCache.delete(cacheKey);
  }, CACHE_TTL);
};

/**
 * Response time tracking middleware
 */
const responseTimeMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Override res.end to capture response time before headers are sent
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    // Log slow requests (over 1 second)
    if (duration > 1000) {
      logger.warn('PERFORMANCE', `Slow request: ${req.method} ${req.url} took ${duration}ms`);
    }
    
    // Add response time header only if headers haven't been sent yet
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${duration}ms`);
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

/**
 * Memory usage monitoring middleware
 */
const memoryMonitoringMiddleware = (req, res, next) => {
  // Only check memory usage periodically to avoid performance impact
  if (Math.random() < 0.01) { // 1% of requests
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    // Log if memory usage is high (over 500MB)
    if (heapUsedMB > 500) {
      logger.warn('MEMORY', `High memory usage: ${heapUsedMB}MB heap used`);
    }
  }
  
  next();
};

/**
 * Error handling optimization middleware
 */
const optimizedErrorHandler = (err, req, res, next) => {
  // Log error with context
  logger.error('REQUEST_ERROR', `${req.method} ${req.path}`, {
    error: err.message,
    stack: err.stack,
    query: req.query,
    params: req.params
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
};

/**
 * Cleanup function for graceful shutdown
 */
const cleanup = () => {
  requestCache.clear();
  logger.info('PERFORMANCE', 'Performance middleware cleanup completed');
};

module.exports = {
  compressionMiddleware,
  requestDeduplicationMiddleware,
  responseTimeMiddleware,
  memoryMonitoringMiddleware,
  optimizedErrorHandler,
  cleanup
};