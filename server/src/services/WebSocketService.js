/**
 * WebSocketService
 * Encapsulates all WebSocket-related functionality for real-time updates
 */
const logger = require('../utils/logger');

class WebSocketService {
  constructor() {
    this.io = null;
    this.activeFriendFetches = new Map();
  }

  /**
   * Initialize the service with Socket.IO instance
   * @param {Object} io - Socket.IO server instance
   */
  initialize(io) {
    this.io = io;
    
    // Setup connection handler
    this.io.on('connection', (socket) => {
      logger.debug('WebSocket', `Client connected: ${socket.id}`);
      
      // Send connection status to the client
      socket.emit('connection:status', { 
        connected: true, 
        socketId: socket.id,
        serverTime: new Date().toISOString() 
      });
      
      // Initialize fetch tracking for this socket
      socket.activeFriendFetches = new Map();
      
      // Copy existing active fetches to the new socket
      this.activeFriendFetches.forEach((value, key) => {
        socket.activeFriendFetches.set(key, value);
      });
      
      // Handle client ping for connection testing
      socket.on('ping', (data, callback) => {
        if (typeof callback === 'function') {
          callback({
            status: 'ok',
            time: new Date().toISOString(),
            echo: data
          });
        } else {
          socket.emit('pong', {
            status: 'ok',
            time: new Date().toISOString(),
            echo: data
          });
        }
      });
      
      // Handle disconnect
      socket.on('disconnect', () => {
        logger.debug('WebSocket', `Client disconnected: ${socket.id}`);
      });
      
      // Handle client request for active fetches
      socket.on('friendFetch:getActive', (data, callback) => {
        const activeFetchesArray = this.getActiveFriendFetches();
        if (typeof callback === 'function') {
          callback(activeFetchesArray);
        } else {
          socket.emit('friendFetch:activeFetches', activeFetchesArray);
        }
      });
      
      // Send initial active fetches to new client
      if (this.activeFriendFetches.size > 0) {
        const activeFetchesArray = [];
        this.activeFriendFetches.forEach((value, key) => {
          activeFetchesArray.push({
            steamId: key,
            ...value
          });
        });
        
        socket.emit('friendFetch:activeFetches', activeFetchesArray);
      }
    });
    
    logger.info('WebSocket', 'Service initialized');
  }

  /**
   * Start tracking a friend fetch process
   * @param {string} steamId - Steam ID of the profile being processed
   * @returns {Object} - Initial progress object
   */
  startFriendFetch(steamId) {
    const progress = {
      steamId,
      friendsTotal: 0,
      totalProcessed: 0,
      successCount: 0,
      status: 'running',
      startTime: Date.now(),
      active: true,
      percentComplete: 0,
      lastUpdated: Date.now()
    };
    
    // Add to tracking map
    this.activeFriendFetches.set(steamId, progress);
    
    // Update all connected sockets
    if (this.io) {
      this.io.sockets.sockets.forEach(socket => {
        if (socket.activeFriendFetches instanceof Map) {
          socket.activeFriendFetches.set(steamId, progress);
        }
      });
      
      // Broadcast initial status
      this.io.emit(`friendFetch:${steamId}:progress`, progress);
      this.io.emit('friendFetch:progress', progress);
    }
    
    return progress;
  }

  /**
   * Update the progress of a friend fetch process
   * @param {string} steamId - Steam ID of the profile being processed
   * @param {Object} progressUpdate - Progress data to update
   */
  updateFriendFetchProgress(steamId, progressUpdate) {
    // Get existing progress
    const existingProgress = this.activeFriendFetches.get(steamId) || {};
    
    // Calculate percentage
    let percentComplete = 0;
    if (progressUpdate.friendsTotal && progressUpdate.totalProcessed) {
      percentComplete = Math.floor((progressUpdate.totalProcessed / progressUpdate.friendsTotal) * 100);
    }
    
    // Update progress
    const updatedProgress = {
      ...existingProgress,
      ...progressUpdate,
      percentComplete,
      lastUpdated: Date.now()
    };
    
    // Update tracking map
    this.activeFriendFetches.set(steamId, updatedProgress);
    
    // Update all connected sockets
    if (this.io) {
      this.io.sockets.sockets.forEach(socket => {
        if (socket.activeFriendFetches instanceof Map) {
          socket.activeFriendFetches.set(steamId, updatedProgress);
        }
      });
      
      // Broadcast progress update
      if (this.io.sockets.sockets.size > 0) {
        logger.debug('WebSocket', `Broadcasting progress update for ${steamId} to ${this.io.sockets.sockets.size} clients`);
      }
      this.io.emit(`friendFetch:${steamId}:progress`, updatedProgress);
      this.io.emit('friendFetch:progress', updatedProgress);
    }
    
    return updatedProgress;
  }

  /**
   * Complete a friend fetch process
   * @param {string} steamId - Steam ID of the profile being processed
   * @param {Object} completionData - Final completion data
   */
  completeFriendFetch(steamId, completionData) {
    // Get existing progress
    const existingProgress = this.activeFriendFetches.get(steamId) || {};
    
    // Create final progress object
    const finalProgress = {
      ...existingProgress,
      ...completionData,
      status: 'completed',
      active: false,
      percentComplete: 100,
      endTime: Date.now(),
      processingTimeSeconds: (Date.now() - (existingProgress.startTime || Date.now())) / 1000,
      lastUpdated: Date.now()
    };
    
    // Update tracking map
    this.activeFriendFetches.set(steamId, finalProgress);
    
    // Log completion
    logger.info('WebSocket', `✅ Friend fetching completed for ${steamId} - ${finalProgress.totalProcessed || 0} friends processed`);

    // Update all connected sockets and emit completion events
    if (this.io) {
      this.io.sockets.sockets.forEach(socket => {
        if (socket.activeFriendFetches instanceof Map) {
          socket.activeFriendFetches.set(steamId, finalProgress);
        }
      });

      // Log WebSocket emission
      logger.debug('WebSocket', `Emitting friendFetch completion events for ${steamId} to ${this.io.sockets.sockets.size} clients`);

      // Broadcast completion events
      this.io.emit(`friendFetch:${steamId}:complete`, finalProgress);
      this.io.emit('friendFetch:complete', finalProgress);
      this.io.emit(`friendFetch:${steamId}:progress`, {
        steamId,
        status: 'complete',
        percentComplete: 100,
        processed: finalProgress.totalProcessed,
        successful: finalProgress.successCount,
        metrics: completionData.metrics
      });
    }

    return finalProgress;
  }

  broadcastInventoryUpdate(steamId, inventoryData) {
    if (this.io) {
      this.io.emit('inventory:update', { steamId, ...inventoryData });
    }
  }

  /**
   * Handle error in a friend fetch process
   * @param {string} steamId - Steam ID of the profile being processed
   * @param {Error} error - The error that occurred
   */
  errorFriendFetch(steamId, error) {
    // Get existing progress
    const existingProgress = this.activeFriendFetches.get(steamId) || {};
    
    // Create error progress object
    const errorProgress = {
      ...existingProgress,
      steamId,
      status: 'error',
      error: error.message,
      active: false,
      endTime: Date.now(),
      lastUpdated: Date.now()
    };
    
    // Update tracking map
    this.activeFriendFetches.set(steamId, errorProgress);
    
    // Update all connected sockets and emit error events
    if (this.io) {
      this.io.sockets.sockets.forEach(socket => {
        if (socket.activeFriendFetches instanceof Map) {
          socket.activeFriendFetches.set(steamId, errorProgress);
        }
      });
      
      // Broadcast error events
      this.io.emit(`friendFetch:${steamId}:error`, errorProgress);
      this.io.emit(`friendFetch:${steamId}:progress`, errorProgress);
    }
    
    return errorProgress;
  }

  /**
   * Get all active friend fetch processes
   * @returns {Array} - Array of active fetch objects
   */
  getActiveFriendFetches() {
    const result = [];
    this.activeFriendFetches.forEach((value, key) => {
      result.push({
        steamId: key,
        ...value
      });
    });
    return result;
  }
  
  /**
   * Broadcast server status to all connected clients
   * Useful for the frontend to know server is up and running
   */
  broadcastServerStatus() {
    if (!this.io) return;
    
    const status = {
      online: true,
      uptime: process.uptime(),
      time: new Date().toISOString(),
      activeFetches: this.activeFriendFetches.size
    };
    
    this.io.emit('server:status', status);
    logger.debug('WebSocket', 'Server status broadcast sent');
    
    return status;
  }

  /**
   * Get a specific friend fetch progress
   * @param {string} steamId - Steam ID to get progress for
   * @returns {Object|null} - Progress object or null if not found
   */
  getFriendFetchProgress(steamId) {
    return this.activeFriendFetches.get(steamId) || null;
  }
}

module.exports = new WebSocketService();
