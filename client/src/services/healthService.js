import { apiClient } from './api';

/**
 * Service for monitoring server health and implementing graceful degradation
 */
class HealthService {
  constructor() {
    this.lastHealthCheck = null;
    this.healthCheckInterval = null;
    this.isServerHealthy = true;
    this.listeners = new Set();
  }

  /**
   * Check server health status
   * @returns {Promise<Object>} Health status object
   */
  async checkHealth() {
    try {
      const response = await apiClient.get('/health', {
        timeout: 5000 // Short timeout for health checks
      });
      
      this.lastHealthCheck = {
        timestamp: Date.now(),
        status: response.data.status,
        data: response.data
      };
      
      const wasUnhealthy = !this.isServerHealthy;
      this.isServerHealthy = response.data.status === 'healthy';
      
      // Notify listeners if health status changed
      if (wasUnhealthy && this.isServerHealthy) {
        this.notifyListeners('recovered', response.data);
      } else if (this.isServerHealthy && response.data.status === 'warning') {
        this.notifyListeners('warning', response.data);
      }
      
      return response.data;
    } catch (error) {
      this.lastHealthCheck = {
        timestamp: Date.now(),
        status: 'error',
        error: error.message
      };
      
      const wasHealthy = this.isServerHealthy;
      this.isServerHealthy = false;
      
      // Notify listeners if server became unhealthy
      if (wasHealthy) {
        this.notifyListeners('unhealthy', { error: error.message });
      }
      
      throw error;
    }
  }

  /**
   * Start periodic health monitoring
   * @param {number} interval - Check interval in milliseconds (default: 30 seconds)
   */
  startMonitoring(interval = 30000) {
    if (this.healthCheckInterval) {
      this.stopMonitoring();
    }
    
    // Initial health check
    this.checkHealth().catch(() => {
      // Ignore initial errors
    });
    
    // Set up periodic checks
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth().catch(() => {
        // Errors are handled in checkHealth method
      });
    }, interval);
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get current server health status
   * @returns {boolean} True if server is healthy
   */
  isHealthy() {
    return this.isServerHealthy;
  }

  /**
   * Get last health check result
   * @returns {Object|null} Last health check data
   */
  getLastHealthCheck() {
    return this.lastHealthCheck;
  }

  /**
   * Check if server is under heavy load
   * @returns {boolean} True if server is under heavy load
   */
  isServerUnderLoad() {
    if (!this.lastHealthCheck || !this.lastHealthCheck.data) {
      return false;
    }
    
    const { data } = this.lastHealthCheck;
    return (
      data.status === 'warning' || 
      data.status === 'critical' ||
      (data.memory && data.memory.usagePercent > 80) ||
      (data.cpu && data.cpu.loadAverage && data.cpu.loadAverage[0] > data.cpu.cores * 0.8)
    );
  }

  /**
   * Add a listener for health status changes
   * @param {Function} listener - Callback function (event, data) => {}
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * Remove a health status listener
   * @param {Function} listener - Listener to remove
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of health status changes
   * @param {string} event - Event type ('healthy', 'warning', 'unhealthy', 'recovered')
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        // Health service listener error
      }
    });
  }

  /**
   * Get recommended retry delay based on server health
   * @returns {number} Recommended delay in milliseconds
   */
  getRecommendedRetryDelay() {
    if (!this.isServerHealthy || this.isServerUnderLoad()) {
      return 10000; // 10 seconds for unhealthy/loaded server
    }
    return 2000; // 2 seconds for healthy server
  }

  /**
   * Check if operation should be delayed due to server load
   * @returns {boolean} True if operations should be delayed
   */
  shouldDelayOperations() {
    return this.isServerUnderLoad();
  }
}

// Export singleton instance
export const healthService = new HealthService();
export default healthService;