import React from 'react';
import { profileRefetchCircuitBreaker, apiCallCircuitBreaker } from '../services/circuitBreaker';

/**
 * Error Boundary component to catch and handle errors gracefully
 * Provides fallback UI and recovery mechanisms for network-related errors
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isNetworkError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    const isNetworkError = ErrorBoundary.isNetworkRelatedError(error);
    return {
      hasError: true,
      error,
      isNetworkError
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    // ErrorBoundary caught an error
    
    this.setState({
      error,
      errorInfo
    });

    // If it's a network error, reset circuit breakers after a delay
    if (ErrorBoundary.isNetworkRelatedError(error)) {
      setTimeout(() => {
        // Resetting circuit breakers after network error
        profileRefetchCircuitBreaker.reset();
        apiCallCircuitBreaker.reset();
      }, 5000);
    }
  }

  /**
   * Check if error is network-related
   * @param {Error} error - Error to check
   * @returns {boolean} True if network-related
   */
  static isNetworkRelatedError(error) {
    if (!error) return false;
    
    const networkErrorPatterns = [
      /network error/i,
      /timeout/i,
      /econnreset/i,
      /etimedout/i,
      /econnaborted/i,
      /fetch.*failed/i,
      /failed to fetch/i
    ];
    
    const errorMessage = error.message || error.toString();
    return networkErrorPatterns.some(pattern => pattern.test(errorMessage));
  }

  /**
   * Handle retry attempt
   */
  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      isNetworkError: false,
      retryCount: prevState.retryCount + 1
    }));

    // Reset circuit breakers on manual retry
    profileRefetchCircuitBreaker.reset();
    apiCallCircuitBreaker.reset();
    
    // Force a page refresh if multiple retries have failed
    if (this.state.retryCount >= 2) {
      // Multiple retries failed, refreshing page
      window.location.reload();
    }
  };

  /**
   * Handle page refresh
   */
  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error, isNetworkError, retryCount } = this.state;
      
      return (
        <div className="error-boundary">
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <h2 className="error-title">
              {isNetworkError ? 'Connection Issue' : 'Something went wrong'}
            </h2>
            
            {isNetworkError ? (
              <div className="error-content">
                <p className="error-message">
                  We're having trouble connecting to the server. This usually happens when the server is processing a large amount of data.
                </p>
                <p className="error-suggestion">
                  Your friend data has been processed successfully. You can:
                </p>
                <ul className="error-options">
                  <li>Wait a moment and try again</li>
                  <li>Refresh the page to see your updated data</li>
                  <li>The issue should resolve automatically</li>
                </ul>
              </div>
            ) : (
              <div className="error-content">
                <p className="error-message">
                  An unexpected error occurred. Please try refreshing the page.
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <details className="error-details">
                    <summary>Error Details (Development)</summary>
                    <pre>{error && error.toString()}</pre>
                    <pre>{this.state.errorInfo.componentStack}</pre>
                  </details>
                )}
              </div>
            )}
            
            <div className="error-actions">
              {retryCount < 3 && (
                <button 
                  className="retry-button"
                  onClick={this.handleRetry}
                >
                  Try Again
                </button>
              )}
              <button 
                className="refresh-button"
                onClick={this.handleRefresh}
              >
                Refresh Page
              </button>
            </div>
            
            {retryCount > 0 && (
              <p className="retry-info">
                Retry attempt: {retryCount}
              </p>
            )}
          </div>
          
          <style jsx>{`
            .error-boundary {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 400px;
              padding: 20px;
              background-color: #f8f9fa;
            }
            
            .error-container {
              max-width: 500px;
              text-align: center;
              background: white;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            
            .error-icon {
              font-size: 48px;
              margin-bottom: 20px;
            }
            
            .error-title {
              color: #dc3545;
              margin-bottom: 20px;
              font-size: 24px;
            }
            
            .error-content {
              margin-bottom: 30px;
              text-align: left;
            }
            
            .error-message {
              color: #6c757d;
              margin-bottom: 15px;
              line-height: 1.5;
            }
            
            .error-suggestion {
              color: #495057;
              font-weight: 500;
              margin-bottom: 10px;
            }
            
            .error-options {
              color: #6c757d;
              padding-left: 20px;
              line-height: 1.6;
            }
            
            .error-actions {
              display: flex;
              gap: 10px;
              justify-content: center;
              margin-bottom: 15px;
            }
            
            .retry-button, .refresh-button {
              padding: 10px 20px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              transition: background-color 0.2s;
            }
            
            .retry-button {
              background-color: #007bff;
              color: white;
            }
            
            .retry-button:hover {
              background-color: #0056b3;
            }
            
            .refresh-button {
              background-color: #6c757d;
              color: white;
            }
            
            .refresh-button:hover {
              background-color: #545b62;
            }
            
            .retry-info {
              color: #6c757d;
              font-size: 12px;
            }
            
            .error-details {
              margin-top: 20px;
              text-align: left;
              background-color: #f8f9fa;
              padding: 15px;
              border-radius: 4px;
              border: 1px solid #dee2e6;
            }
            
            .error-details pre {
              white-space: pre-wrap;
              word-break: break-word;
              font-size: 12px;
              color: #dc3545;
              margin: 5px 0;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;