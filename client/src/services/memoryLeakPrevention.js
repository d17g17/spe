/**
 * Memory Leak Prevention Service
 * Handles cleanup of event listeners, timers, and other resources
 */

class MemoryLeakPrevention {
  constructor() {
    this.activeTimers = new Set();
    this.activeIntervals = new Set();
    this.activeEventListeners = new Map();
    this.activeAbortControllers = new Set();
    this.componentCleanupCallbacks = new Map();
  }

  /**
   * Register a timer for cleanup
   * @param {number} timerId - Timer ID from setTimeout
   * @returns {number} - The timer ID
   */
  registerTimer(timerId) {
    this.activeTimers.add(timerId);
    return timerId;
  }

  /**
   * Register an interval for cleanup
   * @param {number} intervalId - Interval ID from setInterval
   * @returns {number} - The interval ID
   */
  registerInterval(intervalId) {
    this.activeIntervals.add(intervalId);
    return intervalId;
  }

  /**
   * Register an event listener for cleanup
   * @param {EventTarget} target - Event target
   * @param {string} event - Event name
   * @param {Function} listener - Event listener function
   * @param {Object} options - Event listener options
   */
  registerEventListener(target, event, listener, options = {}) {
    const key = `${target.constructor.name}_${event}_${Date.now()}`;
    this.activeEventListeners.set(key, { target, event, listener, options });
    target.addEventListener(event, listener, options);
    return key;
  }

  /**
   * Register an AbortController for cleanup
   * @param {AbortController} controller - AbortController instance
   * @returns {AbortController} - The controller
   */
  registerAbortController(controller) {
    this.activeAbortControllers.add(controller);
    return controller;
  }

  /**
   * Register a cleanup callback for a component
   * @param {string} componentId - Unique component identifier
   * @param {Function} cleanupCallback - Cleanup function
   */
  registerComponentCleanup(componentId, cleanupCallback) {
    if (!this.componentCleanupCallbacks.has(componentId)) {
      this.componentCleanupCallbacks.set(componentId, []);
    }
    this.componentCleanupCallbacks.get(componentId).push(cleanupCallback);
  }

  /**
   * Clear a specific timer
   * @param {number} timerId - Timer ID to clear
   */
  clearTimer(timerId) {
    if (this.activeTimers.has(timerId)) {
      clearTimeout(timerId);
      this.activeTimers.delete(timerId);
    }
  }

  /**
   * Clear a specific interval
   * @param {number} intervalId - Interval ID to clear
   */
  clearInterval(intervalId) {
    if (this.activeIntervals.has(intervalId)) {
      clearInterval(intervalId);
      this.activeIntervals.delete(intervalId);
    }
  }

  /**
   * Remove a specific event listener
   * @param {string} key - Event listener key
   */
  removeEventListener(key) {
    const listener = this.activeEventListeners.get(key);
    if (listener) {
      listener.target.removeEventListener(listener.event, listener.listener, listener.options);
      this.activeEventListeners.delete(key);
    }
  }

  /**
   * Abort a specific controller
   * @param {AbortController} controller - Controller to abort
   */
  abortController(controller) {
    if (this.activeAbortControllers.has(controller)) {
      controller.abort();
      this.activeAbortControllers.delete(controller);
    }
  }

  /**
   * Clean up resources for a specific component
   * @param {string} componentId - Component identifier
   */
  cleanupComponent(componentId) {
    const callbacks = this.componentCleanupCallbacks.get(componentId);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          // Silently handle cleanup errors to prevent console pollution
        }
      });
      this.componentCleanupCallbacks.delete(componentId);
    }
  }

  /**
   * Clean up all active timers
   */
  clearAllTimers() {
    this.activeTimers.forEach(timerId => clearTimeout(timerId));
    this.activeTimers.clear();
  }

  /**
   * Clean up all active intervals
   */
  clearAllIntervals() {
    this.activeIntervals.forEach(intervalId => clearInterval(intervalId));
    this.activeIntervals.clear();
  }

  /**
   * Remove all active event listeners
   */
  removeAllEventListeners() {
    this.activeEventListeners.forEach((listener, key) => {
      listener.target.removeEventListener(listener.event, listener.listener, listener.options);
    });
    this.activeEventListeners.clear();
  }

  /**
   * Abort all active controllers
   */
  abortAllControllers() {
    this.activeAbortControllers.forEach(controller => {
      try {
        controller.abort();
      } catch (error) {
        // Silently handle abort errors to prevent console pollution
      }
    });
    this.activeAbortControllers.clear();
  }

  /**
   * Clean up all resources
   */
  cleanupAll() {
    this.clearAllTimers();
    this.clearAllIntervals();
    this.removeAllEventListeners();
    this.abortAllControllers();
    
    // Run all component cleanup callbacks
    this.componentCleanupCallbacks.forEach((callbacks, componentId) => {
      callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          // Silently handle cleanup errors to prevent console pollution
        }
      });
    });
    this.componentCleanupCallbacks.clear();
  }

  /**
   * Get memory usage statistics
   * @returns {Object} - Memory usage stats
   */
  getMemoryStats() {
    return {
      activeTimers: this.activeTimers.size,
      activeIntervals: this.activeIntervals.size,
      activeEventListeners: this.activeEventListeners.size,
      activeAbortControllers: this.activeAbortControllers.size,
      componentsWithCleanup: this.componentCleanupCallbacks.size
    };
  }

  /**
   * Create a safe setTimeout that auto-registers for cleanup
   * @param {Function} callback - Callback function
   * @param {number} delay - Delay in milliseconds
   * @returns {number} - Timer ID
   */
  safeSetTimeout(callback, delay) {
    const timerId = setTimeout(() => {
      this.activeTimers.delete(timerId);
      callback();
    }, delay);
    return this.registerTimer(timerId);
  }

  /**
   * Create a safe setInterval that auto-registers for cleanup
   * @param {Function} callback - Callback function
   * @param {number} interval - Interval in milliseconds
   * @returns {number} - Interval ID
   */
  safeSetInterval(callback, interval) {
    const intervalId = setInterval(callback, interval);
    return this.registerInterval(intervalId);
  }

  /**
   * Create a safe fetch with AbortController
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise} - Fetch promise
   */
  safeFetch(url, options = {}) {
    const controller = new AbortController();
    this.registerAbortController(controller);
    
    const fetchOptions = {
      ...options,
      signal: controller.signal
    };

    return fetch(url, fetchOptions).finally(() => {
      this.activeAbortControllers.delete(controller);
    });
  }
}

// Create and export singleton instance
const memoryLeakPrevention = new MemoryLeakPrevention();

// Clean up on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    memoryLeakPrevention.cleanupAll();
  });

  // Clean up on visibility change (when tab becomes hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Optionally clean up some resources when tab is hidden
      memoryLeakPrevention.clearAllTimers();
    }
  });
}

export default memoryLeakPrevention;

// Export React hook for easy component integration
export const useMemoryLeakPrevention = (componentId) => {
  const { useEffect, useCallback } = require('react');
  
  const registerCleanup = useCallback((cleanupFn) => {
    memoryLeakPrevention.registerComponentCleanup(componentId, cleanupFn);
  }, [componentId]);

  const safeSetTimeout = useCallback((callback, delay) => {
    return memoryLeakPrevention.safeSetTimeout(callback, delay);
  }, []);

  const safeSetInterval = useCallback((callback, interval) => {
    return memoryLeakPrevention.safeSetInterval(callback, interval);
  }, []);

  const safeFetch = useCallback((url, options) => {
    return memoryLeakPrevention.safeFetch(url, options);
  }, []);

  useEffect(() => {
    return () => {
      memoryLeakPrevention.cleanupComponent(componentId);
    };
  }, [componentId]);

  return {
    registerCleanup,
    safeSetTimeout,
    safeSetInterval,
    safeFetch,
    getStats: () => memoryLeakPrevention.getMemoryStats()
  };
};