/**
 * Circuit Breaker implementation for handling repeated failures gracefully
 * Prevents cascading failures and provides fallback mechanisms
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.recoveryTimeout = options.recoveryTimeout || 30000; // 30 seconds
    this.monitoringPeriod = options.monitoringPeriod || 60000; // 1 minute
    this.expectedErrors = options.expectedErrors || [];
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.successCount = 0;
    this.totalRequests = 0;
    
    // Statistics for monitoring
    this.stats = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      lastReset: Date.now()
    };
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Function to execute
   * @param {*} fallback - Fallback value/function if circuit is open
   * @returns {Promise} Result of function execution or fallback
   */
  async execute(fn, fallback = null) {
    this.totalRequests++;
    this.stats.totalRequests++;
    
    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        // Circuit breaker is OPEN, using fallback
        return this.handleFallback(fallback);
      } else {
        // Try to transition to half-open
        this.state = 'HALF_OPEN';
        // Circuit breaker transitioning to HALF_OPEN
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      
      // If circuit is now open, use fallback
      if (this.state === 'OPEN') {
        // Circuit breaker opened due to failure, using fallback
        return this.handleFallback(fallback);
      }
      
      // Re-throw error if circuit is still closed/half-open
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  onSuccess() {
    this.failureCount = 0;
    this.successCount++;
    this.stats.totalSuccesses++;
    
    if (this.state === 'HALF_OPEN') {
      // Circuit breaker transitioning to CLOSED after successful recovery
      this.state = 'CLOSED';
    }
  }

  /**
   * Handle failed execution
   * @param {Error} error - The error that occurred
   */
  onFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.stats.totalFailures++;
    
    // Check if error should be ignored (expected errors)
    if (this.isExpectedError(error)) {
      // Expected error encountered, not counting towards circuit breaker
      return;
    }
    
    // Open circuit if failure threshold reached
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.recoveryTimeout;
      // Circuit breaker OPENED after failures
    }
  }

  /**
   * Check if error is expected and should not trigger circuit breaker
   * @param {Error} error - Error to check
   * @returns {boolean} True if error is expected
   */
  isExpectedError(error) {
    return this.expectedErrors.some(expectedError => {
      if (typeof expectedError === 'string') {
        return error.message.includes(expectedError);
      }
      if (expectedError instanceof RegExp) {
        return expectedError.test(error.message);
      }
      if (typeof expectedError === 'function') {
        return expectedError(error);
      }
      return false;
    });
  }

  /**
   * Handle fallback execution
   * @param {*} fallback - Fallback value or function
   * @returns {*} Fallback result
   */
  async handleFallback(fallback) {
    if (typeof fallback === 'function') {
      try {
        return await fallback();
      } catch (error) {
        // Fallback function failed
        return null;
      }
    }
    return fallback;
  }

  /**
   * Manually reset the circuit breaker
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    // Circuit breaker manually reset
  }

  /**
   * Get current circuit breaker status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      stats: { ...this.stats },
      isHealthy: this.state === 'CLOSED'
    };
  }

  /**
   * Check if circuit breaker is healthy (closed state)
   * @returns {boolean} True if circuit is closed
   */
  isHealthy() {
    return this.state === 'CLOSED';
  }
}

// Create circuit breaker instances for different operations
export const profileRefetchCircuitBreaker = new CircuitBreaker({
  failureThreshold: 4, // Open after 4 failures (increased from 2)
  recoveryTimeout: 30000, // 30 seconds recovery time (reduced from 60s)
  expectedErrors: [
    'timeout', // Network timeouts are expected during heavy load
    'Network Error', // Generic network errors
    'ECONNRESET', // Connection reset errors
    'ETIMEDOUT', // Timeout errors
    'Failed to get friends list from backend', // Expected during cache-only operations
    (error) => error.code === 'ECONNABORTED', // Axios timeout errors
    (error) => error.response?.status >= 500 // Server errors
  ]
});

export const apiCallCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  recoveryTimeout: 30000,
  expectedErrors: [
    'timeout',
    'Network Error',
    (error) => error.response?.status >= 500
  ]
});

export default CircuitBreaker;