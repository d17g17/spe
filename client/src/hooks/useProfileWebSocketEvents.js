import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotification } from '../context/NotificationContext';
import socketService from '../services/socketService';
import friendFetchManager from '../services/FriendFetchManager';
import { healthService } from '../services/healthService';
import { profileRefetchCircuitBreaker } from '../services/circuitBreaker';
import { notificationService } from '../services/notificationService';

/**
 * Custom hook to handle all WebSocket events related to profile page
 * 
 * @param {string} steamId - The Steam ID of the profile
 * @param {Function} refetchProfile - Function to refetch profile data
 * @param {Function} refetchFriends - Function to refetch friends data
 */
export const useProfileWebSocketEvents = (steamId, refetchProfile, refetchFriends) => {
  const [friendFetchStatus, setFriendFetchStatus] = useState(null);
  const [refreshingFriends, setRefreshingFriends] = useState([]);
  const { showSuccess, showError } = useNotification();
  const queryClient = useQueryClient();


  useEffect(() => {
    if (!steamId) return;
    
    const socket = socketService.getSocket();
    
    // Friend fetch events
    const handleFriendFetchStart = (data) => {
      if (data.steamId === steamId) {
        setFriendFetchStatus({
          status: 'starting',
          message: 'Starting friend fetch process...',
        });
      }
    };
    

    
    const handleInventoryUpdate = (data) => {
      if (!data || !data.steamId) return;

      queryClient.setQueryData(['profileFriends', steamId], (oldData) => {
        if (!oldData || !oldData.friends) return oldData;

        const newFriends = oldData.friends.map(friend => {
          if (friend.steamId === data.steamId) {
            return { ...friend, inventoryValue: data.totalValueUsd, inventoryStatus: data.status };
          }
          return friend;
        });

        return { ...oldData, friends: newFriends };
      });

      if (data.steamId === steamId) {
        queryClient.invalidateQueries({ queryKey: ['profile', steamId] });
        queryClient.invalidateQueries({ queryKey: ['cs2Inventory', steamId] });
      }
    };

    // Inventory check completion event
    const handleInventoryCheckComplete = async (data) => {
      if (!data || !data.steamId) return;

      queryClient.setQueryData(['profileFriends', steamId], (oldData) => {
        if (!oldData || !oldData.friends) return oldData;

        const newFriends = oldData.friends.map(friend => {
          if (friend.steamId === data.steamId) {
            return { ...friend, ...data.profileData, inventoryValue: data.totalValueUsd, inventoryStatus: data.status };
          }
          return friend;
        });

        return { ...oldData, friends: newFriends };
      });

      if (data.steamId === steamId) {
        queryClient.invalidateQueries({ queryKey: ['profile', steamId] });
        queryClient.invalidateQueries({ queryKey: ['cs2Inventory', steamId] });
      }
    };
    
    const handleFriendFetchProgress = (data) => {
      if (data.steamId === steamId) {
        // Handle various possible field names from server
        // Try all possible field names the server might send for current progress
        const current = typeof data.current === 'number' ? data.current :
                      typeof data.totalProcessed === 'number' ? data.totalProcessed :
                      typeof data.processed === 'number' ? data.processed : 0;
                      
        // Try all possible field names for total
        const total = (typeof data.total === 'number' && data.total > 0) ? data.total :
                    (typeof data.friendsTotal === 'number' && data.friendsTotal > 0) ? data.friendsTotal :
                    (typeof data.totalFriends === 'number' && data.totalFriends > 0) ? data.totalFriends : 100;
                    
        // Use percentage if provided, otherwise calculate it
        const percentage = typeof data.percentage === 'number' ? data.percentage :
                          (total > 0) ? Math.round((current / total) * 100) : 0;
        
        // Detailed logging to debug progress
        
        
        // Update the UI with normalized data
        setFriendFetchStatus({
          status: 'in_progress',
          current, 
          total,
          percentage,
          message: `Processing friends: ${current}/${total}`,
          lastUpdated: Date.now()
        });
      }
    };
    
    const handleFriendFetchComplete = async (data) => {
      // Friend fetch completion event received
      if (data.steamId === steamId) {
        setFriendFetchStatus({
          status: 'completed',
          message: 'Friend fetch process completed',
        });
        
        // Show success notification - try multiple possible field names
        const friendCount = data.friendCount || data.successCount || data.totalFriends || data.processedFriends || 'your';
        notificationService.friendProcessingComplete(friendCount);
        
        // Log current cache state before invalidation
        const currentFriendsData = queryClient.getQueryData(['profileFriends', steamId]);
        const currentProfileData = queryClient.getQueryData(['profile', steamId]);
        // Checking current cache state before invalidation
        
        // Invalidate friends data immediately but don't refetch yet to prevent race conditions
        // Invalidating friends data
        queryClient.invalidateQueries({ 
          queryKey: ['profileFriends', steamId]
        });
        
        // Use circuit breaker for profile refetch with graceful fallback
        const profileRefetchWithFallback = async () => {
          return await profileRefetchCircuitBreaker.execute(
            async () => {
              // Force invalidate profile data first
              // Invalidating profile data
              queryClient.invalidateQueries({ queryKey: ['profile', steamId] });
              
              // Wait a brief moment for any pending inventory checks to complete
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Now refetch both profile and friends data in sequence
              const profileRefetchResult = await queryClient.refetchQueries({ queryKey: ['profile', steamId] });
              const friendsRefetchResult = await queryClient.refetchQueries({ queryKey: ['profileFriends', steamId] });
              
              const newProfileData = queryClient.getQueryData(['profile', steamId]);
              const newFriendsData = queryClient.getQueryData(['profileFriends', steamId]);
              // Profile and friends refetch completed successfully
              return true;
            },
            async () => {
              // Fallback: silently skip profile refetch
              // Profile refetch skipped due to circuit breaker
              notificationService.circuitBreakerOpen('Profile refresh');
              return false;
            }
          );
        };
        
        // Enhanced retry mechanism for final updates
        const retryProfileRefetch = async (attempt = 1, maxAttempts = 4) => {
          try {
            const success = await profileRefetchWithFallback();
            if (success) {
              // Profile refetch successful, update sequence completed
            }
          } catch (error) {
            // Profile refetch failed on attempt
            
            if (attempt < maxAttempts && profileRefetchCircuitBreaker.isHealthy()) {
              // Show retry notification for user awareness
              if (attempt === 1) {
                notificationService.networkIssue('profile refresh', { duration: 4000 });
              }
              
              // Use health service to determine appropriate delay
              const baseDelay = healthService.getRecommendedRetryDelay();
              
              // Progressive delay with circuit breaker awareness
              let delay = baseDelay * attempt;
              
              // Add extra delay if server is under load
              if (healthService.shouldDelayOperations()) {
                delay += 5000; // Reduced from 8s to 5s for faster recovery
                // Server under heavy load, adding extra delay
                if (attempt === 1) {
                  notificationService.serverBusy();
                }
              }
              
              // Retrying profile refetch with delay
              
              setTimeout(() => {
                retryProfileRefetch(attempt + 1, maxAttempts);
              }, delay);
            } else {
              // Profile refetch stopped - circuit breaker or max attempts reached
              
              // Final fallback: force a complete cache refresh
              // Performing final fallback cache refresh
              try {
                queryClient.invalidateQueries({ 
                  predicate: (query) => {
                    const [queryType] = query.queryKey;
                    return queryType === 'profile' || queryType === 'profileFriends';
                  }
                });
                // Fallback cache refresh completed
              } catch (fallbackError) {
                // Fallback cache refresh failed
              }
              
              // Only show notification if circuit breaker is not already open
              if (profileRefetchCircuitBreaker.isHealthy()) {
                notificationService.info(
                  'Profile Refresh Delayed',
                  'Your friend data is processed. Profile will refresh automatically when the server is ready.',
                  { duration: 6000 }
                );
              }
            }
          }
        };
        
        // Start retry process
        retryProfileRefetch();
        

        
        // Clear status after a short delay
        setTimeout(() => {
          setFriendFetchStatus(null);
        }, 3000);
      }
    };
    
    const handleFriendFetchError = (data) => {
      if (data.steamId === steamId) {
        setFriendFetchStatus({
          status: 'error',
          message: `Error: ${data.error || 'Unknown error during friend fetch'}`,
        });
        
        // Clear status after a short delay
        setTimeout(() => {
          setFriendFetchStatus(null);
        }, 5000);
      }
    };
    
    // Friend refresh events
    const handleFriendRefresh = (data) => {
      if (!data) return;
      
      // Mark the profile as refreshing
      if (data.steamId && data.action === 'start') {
        setRefreshingFriends(prev => [...prev, data.steamId]);
  
      }
      
      // Remove the refreshing status when complete
      if (data.steamId && (data.action === 'complete' || data.action === 'error')) {
        setRefreshingFriends(prev => prev.filter(id => id !== data.steamId));
  
        
        // If there was an error, show it to the user
        if (data.action === 'error' && data.error) {
          showError(`Error refreshing friend ${data.steamId}: ${data.error}`);
        }
      }
    };
    
    // Register event handlers for both general and steamId-specific events
    socket.on('friendFetch:start', handleFriendFetchStart);
    socket.on('friendFetch:progress', handleFriendFetchProgress);
    socket.on('friendFetch:complete', handleFriendFetchComplete);
    socket.on('friendFetch:error', handleFriendFetchError);
    socket.on('profile:refresh', handleFriendRefresh);
    
    // Add steamId-specific event listeners (these are the ones actually being emitted by the server)
    socket.on(`friendFetch:${steamId}:progress`, handleFriendFetchProgress);
    socket.on(`friendFetch:${steamId}:complete`, handleFriendFetchComplete);
    socket.on(`friendFetch:${steamId}:error`, handleFriendFetchError);
    
    // Add inventory check completion event listener
    socket.on('inventory:update', handleInventoryUpdate);
    socket.on('inventoryCheck:complete', handleInventoryCheckComplete);

    // Check for any active fetches when component mounts
    const checkActiveFetchStatus = async () => {
      const isActive = friendFetchManager.isActiveFetch(steamId);
      if (isActive) {
        const status = friendFetchManager.getActiveFetchStatus(steamId);
        if (status) {
          // Format the status for display with consistent structure
          let formattedStatus = {
            status: status.status || 'in_progress',
            message: 'Processing friends...',
            lastUpdated: Date.now()
          };
          
          // Add progress details if available
          if (status.progress && typeof status.progress === 'number') {
            formattedStatus.current = status.progress;
            formattedStatus.total = status.total || 100;
            formattedStatus.percentage = Math.round((formattedStatus.current / formattedStatus.total) * 100);
            formattedStatus.message = `Processing friends: ${formattedStatus.current}/${formattedStatus.total}`;
          } else if (status.progress && typeof status.progress === 'object') {
            // Handle case where progress is an object
            formattedStatus.current = status.progress.current || 0;
            formattedStatus.total = status.progress.total || 100;
            formattedStatus.percentage = Math.round((formattedStatus.current / formattedStatus.total) * 100);
            formattedStatus.message = `Processing friends: ${formattedStatus.current}/${formattedStatus.total}`;
          }
          
          setFriendFetchStatus(formattedStatus);
    
        }
      }
    };
    
    checkActiveFetchStatus();
    
    // Clean up event handlers on unmount
    return () => {
      // Cleanup event handlers when component unmounts
      if (socket) {
        socket.off('friendFetch:start', handleFriendFetchStart);
        socket.off('friendFetch:progress', handleFriendFetchProgress);
        socket.off('friendFetch:complete', handleFriendFetchComplete);
        socket.off('friendFetch:error', handleFriendFetchError);
        socket.off('profile:refresh', handleFriendRefresh);
        
        // Also cleanup steamId-specific event listeners
        socket.off(`friendFetch:${steamId}:start`, handleFriendFetchStart);
        socket.off(`friendFetch:${steamId}:progress`, handleFriendFetchProgress);
        socket.off(`friendFetch:${steamId}:complete`, handleFriendFetchComplete);
        socket.off(`friendFetch:${steamId}:error`, handleFriendFetchError);
        
        // Cleanup inventory check completion event listener
        socket.off('inventory:update', handleInventoryUpdate);
        socket.off('inventoryCheck:complete', handleInventoryCheckComplete);
        
  
      }
    };
  }, [steamId, refetchProfile, refetchFriends, showError]);

  return {
    friendFetchStatus,
    refreshingFriends
  };
};

export default useProfileWebSocketEvents;
