import { useState, useCallback, useRef, useEffect } from 'react';
import { useMemoryLeakPrevention } from '../services/memoryLeakPrevention';

/**
 * Custom hook for managing feedback messages (success, error, info, etc.)
 * 
 * @param {number} autoDismissTime - Time in ms before auto-dismissing messages (0 to disable)
 * @returns {Object} - Feedback message state and setter functions
 */
const useFeedbackMessage = (autoDismissTime = 5000) => {
  const [feedbackMessage, setFeedbackMessageState] = useState(null);
  const { safeSetTimeout } = useMemoryLeakPrevention('useFeedbackMessage');
  const timeoutRef = useRef(null);
  
  // Clear the feedback message
  const clearFeedback = useCallback(() => {
    setFeedbackMessageState(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  // Set a new feedback message
  const setFeedbackMessage = useCallback((type, text) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setFeedbackMessageState({ type, text });
    
    // Auto-dismiss if enabled
    if (autoDismissTime > 0) {
      timeoutRef.current = safeSetTimeout(() => {
        clearFeedback();
      }, autoDismissTime);
    }
  }, [autoDismissTime, clearFeedback, safeSetTimeout]);
  
  // Helper functions for common message types
  const showSuccess = useCallback((text) => {
    setFeedbackMessage('success', text);
  }, [setFeedbackMessage]);
  
  const showError = useCallback((text) => {
    setFeedbackMessage('error', text);
  }, [setFeedbackMessage]);
  
  const showInfo = useCallback((text) => {
    setFeedbackMessage('info', text);
  }, [setFeedbackMessage]);
  
  const showWarning = useCallback((text) => {
    setFeedbackMessage('warning', text);
  }, [setFeedbackMessage]);
  
  return {
    feedbackMessage,
    setFeedbackMessage,
    clearFeedback,
    showSuccess,
    showError,
    showInfo,
    showWarning
  };
};

export default useFeedbackMessage;
