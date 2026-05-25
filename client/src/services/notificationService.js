/**
 * Notification service for handling user-friendly messages
 * Provides gentle feedback for network issues and system status
 */
class NotificationService {
  constructor() {
    this.notifications = [];
    this.listeners = [];
    this.maxNotifications = 5;
    this.defaultDuration = 5000; // 5 seconds
  }

  /**
   * Add a notification
   * @param {Object} notification - Notification object
   * @param {string} notification.type - Type: 'info', 'success', 'warning', 'error'
   * @param {string} notification.title - Notification title
   * @param {string} notification.message - Notification message
   * @param {number} notification.duration - Duration in ms (0 = persistent)
   * @param {boolean} notification.dismissible - Can be manually dismissed
   */
  addNotification(notification) {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      type: notification.type || 'info',
      title: notification.title || '',
      message: notification.message || '',
      duration: notification.duration !== undefined ? notification.duration : this.defaultDuration,
      dismissible: notification.dismissible !== false,
      timestamp: Date.now()
    };

    // Remove oldest notification if at max capacity
    if (this.notifications.length >= this.maxNotifications) {
      this.notifications.shift();
    }

    this.notifications.push(newNotification);
    this.notifyListeners();

    // Auto-remove after duration (if not persistent)
    if (newNotification.duration > 0) {
      setTimeout(() => {
        this.removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }

  /**
   * Remove a notification by ID
   * @param {string|number} id - Notification ID
   */
  removeNotification(id) {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      this.notifications.splice(index, 1);
      this.notifyListeners();
    }
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    this.notifications = [];
    this.notifyListeners();
  }

  /**
   * Get all current notifications
   * @returns {Array} Array of notifications
   */
  getNotifications() {
    return [...this.notifications];
  }

  /**
   * Subscribe to notification changes
   * @param {Function} listener - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of changes
   */
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.notifications);
      } catch (error) {
        // Error in notification listener
      }
    });
  }

  // Convenience methods for different notification types

  /**
   * Show info notification
   * @param {string} title - Title
   * @param {string} message - Message
   * @param {Object} options - Additional options
   */
  info(title, message, options = {}) {
    return this.addNotification({
      type: 'info',
      title,
      message,
      ...options
    });
  }

  /**
   * Show success notification
   * @param {string} title - Title
   * @param {string} message - Message
   * @param {Object} options - Additional options
   */
  success(title, message, options = {}) {
    return this.addNotification({
      type: 'success',
      title,
      message,
      ...options
    });
  }

  /**
   * Show warning notification
   * @param {string} title - Title
   * @param {string} message - Message
   * @param {Object} options - Additional options
   */
  warning(title, message, options = {}) {
    return this.addNotification({
      type: 'warning',
      title,
      message,
      ...options
    });
  }

  /**
   * Show error notification
   * @param {string} title - Title
   * @param {string} message - Message
   * @param {Object} options - Additional options
   */
  error(title, message, options = {}) {
    return this.addNotification({
      type: 'error',
      title,
      message,
      ...options
    });
  }

  // Specialized methods for common scenarios

  /**
   * Show network issue notification
   * @param {string} operation - What operation failed
   * @param {Object} options - Additional options
   */
  networkIssue(operation = 'operation', options = {}) {
    return this.warning(
      'Connection Issue',
      `Having trouble with ${operation}. Your data is safe and we're working to resolve this.`,
      {
        duration: 8000,
        ...options
      }
    );
  }

  /**
   * Show server busy notification
   * @param {Object} options - Additional options
   */
  serverBusy(options = {}) {
    return this.info(
      'Server Busy',
      'The server is processing a lot of data right now. Please wait a moment.',
      {
        duration: 6000,
        ...options
      }
    );
  }

  /**
   * Show friend processing complete notification
   * @param {number} friendCount - Number of friends processed
   * @param {Object} options - Additional options
   */
  friendProcessingComplete(friendCount, options = {}) {
    return this.success(
      'Friends Updated',
      `Successfully processed ${friendCount} friends. Your profile data is being refreshed.`,
      {
        duration: 4000,
        ...options
      }
    );
  }

  /**
   * Show retry notification
   * @param {string} operation - What operation is being retried
   * @param {number} attempt - Current attempt number
   * @param {Object} options - Additional options
   */
  retryNotification(operation, attempt, options = {}) {
    return this.info(
      'Retrying',
      `Retrying ${operation} (attempt ${attempt})...`,
      {
        duration: 3000,
        ...options
      }
    );
  }

  /**
   * Show circuit breaker notification
   * @param {string} service - Which service is affected
   * @param {Object} options - Additional options
   */
  circuitBreakerOpen(service, options = {}) {
    return this.warning(
      'Service Temporarily Unavailable',
      `${service} is temporarily unavailable due to high load. Using cached data where possible.`,
      {
        duration: 10000,
        ...options
      }
    );
  }
}

// Create singleton instance
export const notificationService = new NotificationService();
export default notificationService;