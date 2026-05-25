/**
 * FriendFetchManager
 * Handles business logic related to friend fetching operations
 */
import { getSocket, initializeSocket, subscribeFriendFetchEvents } from './socketService';
import { triggerFriendFetch } from './api';

/**
 * Manages the friend fetching process and WebSocket event handling
 */
class FriendFetchManager {
  constructor() {
    this.activeFetches = new Map();
    this.eventHandlers = new Map();
    this.socket = null;
  }

  /**
   * Initialize the WebSocket connection
   */
  initialize() {
    if (!this.socket) {
      this.socket = initializeSocket();
    }
    return this.socket;
  }

  /**
   * Start fetching friends for a profile
   * @param {string} steamId - The Steam ID to fetch friends for
   * @param {Function} onProgress - Callback for progress updates
   * @param {Function} onComplete - Callback for completion
   * @param {Function} onError - Callback for errors
   * @returns {Promise<Object>} - Result of the friend fetch request
   */
  async startFriendFetch(steamId, onProgress, onComplete, onError) {
    if (!steamId) {
      throw new Error('Steam ID is required to fetch friends');
    }

    // Check if there's already a fetch in progress for this Steam ID
    if (this.activeFetches.has(steamId)) {
      return { success: true, alreadyInProgress: true };
    }

    // Initialize the socket if not already done
    this.initialize();
    
    // Setup initial state for this fetch
    this.activeFetches.set(steamId, {
      startTime: Date.now(),
      progress: 0,
      total: 0,
      status: 'starting',
      lastUpdated: Date.now()
    });

    // Setup event handlers using the friendFetch:* events
    // Important: Pass the steamId to listen for steamId-specific events
    const unsubscribe = subscribeFriendFetchEvents({
      steamId, // Pass steamId to subscribe to specific events
      onStart: (data) => {
        if (data.steamId === steamId) {
          // Store this fetch in the active fetches map
          this.activeFetches.set(steamId, {
            startTime: Date.now(),
            progress: data.current || 0,
            total: data.total || data.friendsTotal || 100,
            status: 'starting',
            lastUpdated: Date.now()
          });

        }
      },
      onProgress: (data) => {
        if (data.steamId === steamId) {
          // Update the progress
          const activeFetch = this.activeFetches.get(steamId);
          if (activeFetch) {
            // Determine the current and total values, with fallbacks
            // Server may send different field names depending on context
            const current = typeof data.current === 'number' ? data.current :
                          typeof data.totalProcessed === 'number' ? data.totalProcessed :
                          typeof data.processed === 'number' ? data.processed : 0;
            
            const total = (typeof data.total === 'number' && data.total > 0) ? data.total :
                        (typeof data.friendsTotal === 'number' && data.friendsTotal > 0) ? data.friendsTotal : 100;
            
            // Calculate percentage with safeguards
            const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
            
            this.activeFetches.set(steamId, {
              ...activeFetch,
              progress: current,
              total: total,
              status: 'in_progress',
              percentage: percentage,
              lastUpdated: Date.now()
            });

          }

          // Call the progress callback with normalized data
          if (onProgress) {
            // Normalize the data to ensure consistent structure for callbacks
            const normalizedData = {
              ...data,
              steamId,
              current: typeof data.current === 'number' ? data.current :
                     typeof data.totalProcessed === 'number' ? data.totalProcessed :
                     typeof data.processed === 'number' ? data.processed : 0,
              total: (typeof data.total === 'number' && data.total > 0) ? data.total :
                     (typeof data.friendsTotal === 'number' && data.friendsTotal > 0) ? data.friendsTotal : 100
            };
            
            // Update percentage if missing
            if (typeof normalizedData.percentage !== 'number') {
              normalizedData.percentage = normalizedData.total > 0 ? 
                Math.round((normalizedData.current / normalizedData.total) * 100) : 0;
            }
            
            onProgress(normalizedData);
          }
        }
      },
      onComplete: (data) => {
        if (data.steamId === steamId) {
          // Update the status
          const activeFetch = this.activeFetches.get(steamId);
          if (activeFetch) {
            // For completion, set progress equal to total to show 100%
            this.activeFetches.set(steamId, {
              ...activeFetch,
              progress: activeFetch.total,
              status: 'completed',
              percentage: 100,
              lastUpdated: Date.now(),
              endTime: Date.now(),
              processingTimeSeconds: (Date.now() - activeFetch.startTime) / 1000
            });

          }

          // Call the complete callback with normalized data
          if (onComplete) {
            // Make sure all required fields are present
            const normalizedData = {
              ...data,
              steamId,
              status: 'completed',
              percentage: 100
            };
            onComplete(normalizedData);
          }

          // Clean up after a delay
          setTimeout(() => {
            this.activeFetches.delete(steamId);
          }, 5000);
        }
      },
      onError: (data) => {
        if (data.steamId === steamId) {
          // Update the status
          const activeFetch = this.activeFetches.get(steamId);
          if (activeFetch) {
            this.activeFetches.set(steamId, {
              ...activeFetch,
              status: 'error',
              error: data.error
            });
          }

          // Call the error callback
          if (onError) {
            onError(data);
          }

          // Clean up after a delay
          setTimeout(() => {
            this.activeFetches.delete(steamId);
          }, 5000);
        }
      }
    });

    // Store the unsubscribe function
    this.eventHandlers.set(steamId, unsubscribe);

    try {
      // Make the API request to trigger the friend fetch
      const response = await triggerFriendFetch(steamId);

      if (!response.success) {
        // If not successful, clean up
        this.activeFetches.delete(steamId);
        const unsubscribe = this.eventHandlers.get(steamId);
        if (unsubscribe) {
          unsubscribe();
          this.eventHandlers.delete(steamId);
        }
      }

      return response;
    } catch (error) {
      // Clean up on error
      this.activeFetches.delete(steamId);
      const unsubscribe = this.eventHandlers.get(steamId);
      if (unsubscribe) {
        unsubscribe();
        this.eventHandlers.delete(steamId);
      }

      throw error;
    }
  }

  /**
   * Setup WebSocket event handlers for a friend fetch
   * @param {string} steamId - The Steam ID to set up handlers for
   * @param {Function} onProgress - Callback for progress updates
   * @param {Function} onComplete - Callback for completion
   * @param {Function} onError - Callback for errors
   * @private
   */
  setupEventHandlers(steamId, onProgress, onComplete, onError) {
    // Create handlers for this Steam ID
    const handlers = {
      progress: (data) => {
        if (data.steamId !== steamId) return;
        
        // Extract current and total values from the data
        const current = typeof data.current === 'number' ? data.current : 0;
        const total = (typeof data.total === 'number' && data.total > 0) ? data.total : 100;
        const percentage = Math.round((current / total) * 100);
        
        // Update the progress in our tracking with consistent format
        this.activeFetches.set(steamId, {
          ...this.activeFetches.get(steamId),
          status: 'in_progress',
          progress: current,
          total: total,
          percentage: percentage,
          lastUpdated: Date.now(),
        });
        
        // Call progress callback
        if (onProgress) {
          // Ensure consistent data format in the callback
          const progressData = {
            ...data,
            current: current,
            total: total,
            percentage: percentage,
            steamId: steamId
          };
          onProgress(progressData);
        }
      },
      
      complete: (data) => {
        if (data.steamId !== steamId) return;
        
        // Update completion status
        this.activeFetches.set(steamId, {
          ...this.activeFetches.get(steamId),
          status: 'completed',
          progress: data,
          endTime: Date.now(),
        });
        
        // Call complete callback
        if (onComplete) {
          onComplete(data);
        }
        
        // Cleanup after completion
        setTimeout(() => {
          this.cleanupEventHandlers(steamId);
          this.activeFetches.delete(steamId);
        }, 1000);
      },
      
      error: (data) => {
        if (data.steamId !== steamId) return;
        
        // Update error status
        this.activeFetches.set(steamId, {
          ...this.activeFetches.get(steamId),
          status: 'error',
          error: data.error,
          endTime: Date.now(),
        });
        
        // Call error callback
        if (onError) {
          onError(new Error(data.error || 'Unknown error during friend fetch'));
        }
        
        // Cleanup after error
        setTimeout(() => {
          this.cleanupEventHandlers(steamId);
          this.activeFetches.delete(steamId);
        }, 1000);
      }
    };
    
    // Store handlers for cleanup later
    this.eventHandlers.set(steamId, handlers);
    
    // Subscribe to events
    subscribeToEvent(`friendFetch:${steamId}:progress`, handlers.progress);
    subscribeToEvent(`friendFetch:${steamId}:complete`, handlers.complete);
    subscribeToEvent(`friendFetch:${steamId}:error`, handlers.error);
  }

  /**
   * Cleanup WebSocket event handlers for a Steam ID
   * @param {string} steamId - The Steam ID to clean up handlers for
   * @private
   */
  cleanupEventHandlers(steamId) {
    const handlers = this.eventHandlers.get(steamId);
    if (!handlers) return;
    
    // Unsubscribe from events
    unsubscribeFromEvent(`friendFetch:${steamId}:progress`, handlers.progress);
    unsubscribeFromEvent(`friendFetch:${steamId}:complete`, handlers.complete);
    unsubscribeFromEvent(`friendFetch:${steamId}:error`, handlers.error);
    
    // Remove handlers from map
    this.eventHandlers.delete(steamId);
  }

  /**
   * Check if there's an active friend fetch for a Steam ID
   * @param {string} steamId - The Steam ID to check
   * @returns {boolean} - Whether there's an active fetch
   */
  isActiveFetch(steamId) {
    return this.activeFetches.has(steamId);
  }

  /**
   * Get status of an active friend fetch
   * @param {string} steamId - The Steam ID to get status for
   * @returns {Object|null} - Status object or null if not active
   */
  getActiveFetchStatus(steamId) {
    const status = this.activeFetches.get(steamId) || null;
    
    return status;
  }

  /**
   * Get all active friend fetches
   * @returns {Map} - Map of active fetches
   */
  getAllActiveFetches() {
    return this.activeFetches;
  }
}

// Create and export a singleton instance
const friendFetchManager = new FriendFetchManager();
export default friendFetchManager;
