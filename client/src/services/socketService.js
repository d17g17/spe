import { io } from 'socket.io-client';
import memoryLeakPrevention from './memoryLeakPrevention';

// Determine backend URL. Default to localhost:3002 if not set.
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

// Create a variable to hold the socket instance
let socket;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;
let reconnectTimer = null;

/**
 * Initialize the socket connection to the server
 * @returns {Object} The socket instance
 */
export const initializeSocket = () => {
  if (!socket) {
    socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: false, // Handle reconnection manually
      timeout: 10000,
      forceNew: true
    });

    // Enhanced connection event handling
    socket.on('connect', () => {
      connectionAttempts = 0;
      if (reconnectTimer) {
        memoryLeakPrevention.clearTimer(reconnectTimer);
        reconnectTimer = null;
      }
      // Socket connected successfully
    });

    socket.on('disconnect', (reason) => {
      // Socket disconnected
      // Only attempt reconnection for certain reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect
        return;
      }
      handleReconnection();
    });

    socket.on('connect_error', (error) => {
      // Socket connection error
      handleReconnection();
    });

    socket.on('error', (error) => {
      // Socket error
    });

    // Register socket cleanup
    memoryLeakPrevention.registerComponentCleanup('socketService', () => {
      closeSocket();
    });
  }
  return socket;
};

/**
 * Handle socket reconnection with exponential backoff
 */
const handleReconnection = () => {
  if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
    // Max reconnection attempts reached
    return;
  }

  connectionAttempts++;
  const delay = Math.min(1000 * Math.pow(2, connectionAttempts - 1), 30000); // Max 30 seconds
  
  // Attempting reconnection with delay
  
  reconnectTimer = memoryLeakPrevention.safeSetTimeout(() => {
    if (socket && !socket.connected) {
      socket.connect();
    }
  }, delay);
};

/**
 * Get the current socket instance or initialize a new one
 * @returns {Object} The socket instance
 */
export const getSocket = () => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

/**
 * Subscribe to friend fetch events for a specific steamId
 * @param {Object} options - The event handlers
 * @param {Function} options.onStart - Called when friend fetching starts
 * @param {Function} options.onProgress - Called when progress is updated
 * @param {Function} options.onComplete - Called when friend fetching completes
 * @param {Function} options.onError - Called when an error occurs
 * @param {string} [options.steamId] - Optional specific Steam ID to subscribe to events for
 * @returns {Function} A function to unsubscribe from all events
 */
export const subscribeFriendFetchEvents = ({ 
  onStart, 
  onProgress, 
  onComplete, 
  onError,
  steamId
}) => {
  const socket = getSocket();
  const handlers = {};
  const eventKeys = [];
  
  // Helper function to register event listener with memory leak prevention
  const registerSocketEvent = (eventName, handler) => {
    const key = memoryLeakPrevention.registerEventListener(socket, eventName, handler);
    eventKeys.push({ eventName, handler, key });
  };
  
  // Start event handlers
  if (onStart) {
    handlers.start = onStart;
    registerSocketEvent('friendFetch:start', handlers.start);
    if (steamId) registerSocketEvent(`friendFetch:${steamId}:start`, handlers.start);
  }
  
  // Progress event handlers
  if (onProgress) {
    handlers.progress = onProgress;
    registerSocketEvent('friendFetch:progress', handlers.progress);
    if (steamId) registerSocketEvent(`friendFetch:${steamId}:progress`, handlers.progress);
  }
  
  // Complete event handlers
  if (onComplete) {
    handlers.complete = onComplete;
    registerSocketEvent('friendFetch:complete', handlers.complete);
    if (steamId) registerSocketEvent(`friendFetch:${steamId}:complete`, handlers.complete);
  }
  
  // Error event handlers
  if (onError) {
    handlers.error = onError;
    registerSocketEvent('friendFetch:error', handlers.error);
    if (steamId) registerSocketEvent(`friendFetch:${steamId}:error`, handlers.error);
  }
  
  // Return an unsubscribe function that properly cleans up
  return () => {
    eventKeys.forEach(({ eventName, handler, key }) => {
      socket.off(eventName, handler);
      memoryLeakPrevention.removeEventListener(key);
    });
  };
};

/**
 * Subscribe to a specific socket event
 * @param {string} eventName - The event name to subscribe to
 * @param {Function} callback - The callback function when event is triggered
 */
export const subscribeToEvent = (eventName, callback) => {
  const socket = getSocket();
  const key = memoryLeakPrevention.registerEventListener(socket, eventName, callback);
  
  // Return unsubscribe function
  return () => {
    socket.off(eventName, callback);
    memoryLeakPrevention.removeEventListener(key);
  };
};

/**
 * Unsubscribe from a specific socket event
 * @param {string} eventName - The event name to unsubscribe from
 * @param {Function} callback - The callback function to remove
 */
export const unsubscribeFromEvent = (eventName, callback) => {
  const socket = getSocket();
  socket.off(eventName, callback);
};

/**
 * Close the socket connection
 */
export const closeSocket = () => {
  if (socket) {
    // Clear reconnection timer
    if (reconnectTimer) {
      memoryLeakPrevention.clearTimer(reconnectTimer);
      reconnectTimer = null;
    }
    
    // Remove all listeners
    socket.removeAllListeners();
    
    // Disconnect socket
    socket.disconnect();
    socket = null;
    connectionAttempts = 0;
    
    // Socket connection closed and cleaned up
  }
};

/**
 * Get connection status and statistics
 * @returns {Object} Connection information
 */
export const getConnectionInfo = () => {
  return {
    connected: socket?.connected || false,
    connectionAttempts,
    maxAttempts: MAX_CONNECTION_ATTEMPTS,
    hasReconnectTimer: !!reconnectTimer,
    socketId: socket?.id || null
  };
};

export default {
  initializeSocket,
  getSocket,
  subscribeFriendFetchEvents,
  subscribeToEvent,
  unsubscribeFromEvent,
  closeSocket
};
