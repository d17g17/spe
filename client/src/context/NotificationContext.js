import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Create notification context
const NotificationContext = createContext();

// Types of notifications
const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// Icons for notifications
const NotificationIcon = ({ type }) => {
  switch (type) {
    case NOTIFICATION_TYPES.SUCCESS:
      return (
        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      );
    case NOTIFICATION_TYPES.ERROR:
      return (
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      );
    case NOTIFICATION_TYPES.WARNING:
      return (
        <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
      );
    case NOTIFICATION_TYPES.INFO:
    default:
      return (
        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      );
  }
};

// Notification component
const Notification = ({ notification, onClose }) => {
  const { id, type, message, autoClose } = notification;
  
  // Background color based on type
  const getBgColor = () => {
    switch (type) {
      case NOTIFICATION_TYPES.SUCCESS: return 'bg-green-900 border-green-700';
      case NOTIFICATION_TYPES.ERROR: return 'bg-red-900 border-red-700';
      case NOTIFICATION_TYPES.WARNING: return 'bg-yellow-900 border-yellow-700';
      case NOTIFICATION_TYPES.INFO: 
      default: return 'bg-blue-900 border-blue-700';
    }
  };
  
  // Auto close notification
  React.useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        onClose(id);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [id, autoClose, onClose]);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      className={`flex items-center p-4 mb-4 rounded-lg border shadow-lg ${getBgColor()}`}
    >
      <div className="flex-shrink-0">
        <NotificationIcon type={type} />
      </div>
      <div className="ml-3 mr-8 flex-1 text-white">
        {message}
      </div>
      <button
        onClick={() => onClose(id)}
        className="ml-auto flex-shrink-0 text-slate-400 hover:text-white"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </motion.div>
  );
};

// Notification container component
const NotificationContainer = ({ notifications, onClose }) => {
  return (
    <div className="fixed z-50 top-4 right-4 w-full max-w-sm">
      <AnimatePresence>
        {notifications.map(notification => (
          <Notification 
            key={notification.id} 
            notification={notification} 
            onClose={onClose} 
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Notification provider component
export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  
  // Add notification
  const addNotification = useCallback((type, message, options = {}) => {
    const id = Math.random().toString(36).substring(2, 9);
    const notification = {
      id,
      type,
      message,
      autoClose: options.autoClose !== false, // Default to true
      ...options
    };
    
    setNotifications(prev => [...prev, notification]);
    return id;
  }, []);
  
  // Remove notification
  const removeNotification = useCallback(id => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);
  
  // Success notification
  const showSuccess = useCallback((message, options) => {
    return addNotification(NOTIFICATION_TYPES.SUCCESS, message, options);
  }, [addNotification]);
  
  // Error notification
  const showError = useCallback((message, options) => {
    return addNotification(NOTIFICATION_TYPES.ERROR, message, options);
  }, [addNotification]);
  
  // Warning notification
  const showWarning = useCallback((message, options) => {
    return addNotification(NOTIFICATION_TYPES.WARNING, message, options);
  }, [addNotification]);
  
  // Info notification
  const showInfo = useCallback((message, options) => {
    return addNotification(NOTIFICATION_TYPES.INFO, message, options);
  }, [addNotification]);
  
  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo
      }}
    >
      {children}
      <NotificationContainer 
        notifications={notifications} 
        onClose={removeNotification} 
      />
    </NotificationContext.Provider>
  );
};

// Hook to use notification context
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
