import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ConfirmationDialog from '../components/common/ConfirmationDialog';
import { useSettings } from '../context/SettingsContext';
import { useNotification } from '../context/NotificationContext';
import { useMemoryLeakPrevention } from '../services/memoryLeakPrevention';
import * as apiService from '../services/api';

// Custom hooks
import { useProfileWebSocketEvents } from '../hooks/useProfileWebSocketEvents';
import { useFriendFiltering } from '../hooks/useFriendFiltering';
import { useOptimizedQuery } from '../hooks/useOptimizedQuery';
import { 
  useFetchProfile, 
  useDeleteProfile, 
  useFetchFriends, 
  useProfileFriends,
  useCS2Inventory
} from '../services/reactQueryHooks';

// Components
import ProfileHeader from '../components/profiles/ProfileHeader';
import FriendsList from '../components/friends/FriendsList';

/**
 * ProfilePage component - shows a Steam profile and its friends
 */
const ProfilePage = () => {
  const { steamId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const { settings } = useSettings();
  const { registerCleanup, safeSetTimeout } = useMemoryLeakPrevention('ProfilePage');
  
  // UI state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [isFetchingInventory, setIsFetchingInventory] = useState(false);
  const [autoFetchTriggered, setAutoFetchTriggered] = useState(false);
  
  // Data fetching
  const { 
    data: profile, 
    isLoading: isLoadingProfile, 
    error: profileError, 
    refetch: refetchProfile 
  } = useFetchProfile(steamId, isRefreshingProfile);
  
  const { 
    data: friendsData, 
    isLoading: isLoadingFriends, 
    refetch: refetchFriends 
  } = useProfileFriends(steamId, {
    enabled: true,
    useCachedOnly: true,
  });
  
  const { 
    data: cs2InventoryData, 
    refetch: refetchInventory, 
    isFetching: isInventoryQueryFetching 
  } = useCS2Inventory(steamId);
  
  // WebSocket events hook
  const { 
    friendFetchStatus, 
    refreshingFriends 
  } = useProfileWebSocketEvents(steamId, refetchProfile, refetchFriends);
  
  // Mutations
  const deleteProfileMutation = useDeleteProfile();
  const fetchFriendsMutation = useFetchFriends();
  
  // Process friends data to add inventory badge info
  const enrichedFriends = useMemo(() => {
    if (!friendsData || !friendsData.friends) return [];

    return friendsData.friends.map(friend => {
      // If backend already provided inventoryBadge just keep as-is
      if (friend.inventoryBadge) return friend;

      // Otherwise map the individual inventory fields coming from the LEFT JOIN
      // Only create inventoryBadge if we have actual inventory data (not just null values)
      if (
        friend.inventoryStatus !== undefined && friend.inventoryStatus !== null ||
        friend.inventoryValue !== undefined && friend.inventoryValue !== null ||
        friend.inventorySkipReason !== undefined && friend.inventorySkipReason !== null ||
        friend.inventoryLastChecked !== undefined && friend.inventoryLastChecked !== null
      ) {
        return {
          ...friend,
          inventoryBadge: {
            status: friend.inventoryStatus,
            value: friend.inventoryValue,
            skipReason: friend.inventorySkipReason,
            lastChecked: friend.inventoryLastChecked,
            has2025ServiceMedal: friend.inventoryHas2025ServiceMedal,
            hasPremierSeasonOneMedal: friend.inventoryHasPremierSeasonOneMedal,
            hasPremierSeasonTwoMedal: friend.inventoryHasPremierSeasonTwoMedal,
          },
        };
      }

      return friend;
    });
  }, [friendsData, friendsData?.friends, friendsData?.lastUpdated, friendsData?.pagination?.total]);
  
  // Friends filtering and sorting with custom hook
  const {
    searchQuery,
    setSearchQuery,
    sortOption,
    setSortOption,
    filters,
    filteredFriends,
    handleFilterChange
  } = useFriendFiltering(enrichedFriends, settings?.defaultFriendSort || 'inventoryValue_desc');
  
  // Handle profile refresh with memory leak prevention
  const handleRefreshProfile = useCallback(async () => {
    try {
      setIsRefreshingProfile(true);
      showSuccess('Refreshing profile...', { autoClose: true });
      
      // Force API refresh by calling the API directly
      await apiService.fetchProfile(steamId, true); // true = forceRefresh
      
      // Then refetch to update the UI
      await refetchProfile();
      
      showSuccess('Profile refreshed successfully');
    } catch (error) {
      showError(`Failed to refresh profile: ${error.message}`);
    } finally {
      setIsRefreshingProfile(false);
    }
  }, [steamId, refetchProfile, showSuccess, showError]);
  
  // Handle inventory fetching with memory leak prevention
  const handleFetchInventory = useCallback(async () => {
    setIsFetchingInventory(true);
    try {
      await apiService.fetchCS2Inventory(steamId);
      await refetchInventory();
      return true;
    } catch (error) {
      throw error;
    } finally {
      setIsFetchingInventory(false);
    }
  }, [steamId, refetchInventory]);
  
  // Handle profile deletion with memory leak prevention
  const handleDeleteProfile = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);
  
  const confirmDeleteProfile = useCallback(async () => {
    try {
      await deleteProfileMutation.mutateAsync(steamId);
      showSuccess(`Successfully deleted profile: ${profile?.name || ''}`);
      navigate('/');
    } catch (error) {
      showError(`Failed to delete profile: ${error.message}`);
    }
  }, [deleteProfileMutation, steamId, profile?.name, showSuccess, showError, navigate]);
  
  // Handle friend fetch (manual trigger from button) with memory leak prevention
  const handleFetchFriends = useCallback(async () => {
    // Check if there's already a fetch in progress
    if (friendFetchStatus && friendFetchStatus.status !== 'completed' && friendFetchStatus.status !== 'error') {
      showSuccess('Friend fetch already in progress', { autoClose: true });
      return;
    }
    
    try {
      showSuccess('Starting friend fetch process...', { autoClose: true });
      
      // Use the mutation to trigger friend fetch and establish websocket monitoring
      const result = await fetchFriendsMutation.mutateAsync(steamId);
    } catch (error) {
      showError(`Failed to start friend fetch: ${error.message}`);
    }
  }, [friendFetchStatus, fetchFriendsMutation, steamId, showSuccess, showError]);
  
  // Auto-fetch friends when profile is loaded (only once per profile view) with memory leak prevention
  useEffect(() => {
    // Skip if no profile, auto-fetch disabled, or already triggered
    if (!profile || !settings?.autoFetchFriends || autoFetchTriggered) return;
    
    // Check if profile is private or has 0 friends
    const isPrivateProfile = profile.communityVisibilityState !== 3; // 3 = public
    const hasNoFriends = profile.friendsCount === 0;
    
    if (isPrivateProfile || hasNoFriends) {
      // Mark as triggered so we don't try again
      setAutoFetchTriggered(true);
      return;
    }
    
    // Mark as triggered so we don't fetch multiple times
    setAutoFetchTriggered(true);
    
    // Use safe timeout to prevent memory leaks and race conditions
    const timeoutId = safeSetTimeout(async () => {
      try {
        // First, check if we already have all friends cached
        const cachedFriendsResult = await apiService.getProfileFriends(steamId, { useCachedOnly: true });
        
        // If the profile has a valid friendsCount and all friends are already cached, skip the full fetch
        if (
          profile.friendsCount > 0 && 
          cachedFriendsResult.friends && 
          cachedFriendsResult.pagination && 
          cachedFriendsResult.pagination.total >= profile.friendsCount
        ) {
          showSuccess(`All ${cachedFriendsResult.pagination.total} friends for ${profile.name} already cached.`, { autoClose: true });
          
          // Just refetch through React Query to update UI
          refetchFriends();
          return;
        }
        
        if (settings.alwaysUseCachedOnly) {
          // Use cached data only
          await apiService.getProfileFriends(steamId, { useCachedOnly: true });
          // After direct API call, refetch through React Query to update UI
          refetchFriends();
        } else {
          // Direct API call to trigger friend fetch process
          showSuccess(`Auto-fetching ${profile.friendsCount} friends for ${profile.name}...`, { autoClose: true });
          await apiService.triggerFriendFetch(steamId);
        }
      } catch (error) {
        showError(`Failed to auto-fetch friends: ${error.message}`);
      }
    }, 100); // Small delay to prevent race conditions
    
    // Register cleanup
    registerCleanup(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  }, [profile, settings?.autoFetchFriends, autoFetchTriggered, steamId, safeSetTimeout, registerCleanup, showSuccess, showError, refetchFriends]);
  
  // Reset auto-fetch trigger when profile changes with cleanup
  useEffect(() => {
    setAutoFetchTriggered(false);
    
    // Register cleanup for profile change
    registerCleanup(() => {
      setAutoFetchTriggered(false);
    });
  }, [steamId, registerCleanup]);
  
  // Loading and error states
  if (isLoadingProfile) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (profileError) {
    return (
      <div className="metro-card text-red-500 flex items-center">
        <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Error loading profile: {profileError.message}
      </div>
    );
  }
  
  if (!profile) {
    return (
      <div className="metro-card text-yellow-500 flex items-center">
        <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Profile not found
      </div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ 
        duration: 0.2, 
        ease: "easeOut",
        type: "tween"
      }}
    >
      {/* Profile Header */}
      <ProfileHeader 
        profile={profile}
        cs2InventoryData={cs2InventoryData}
        isRefreshingProfile={isRefreshingProfile}
        isFetchingInventory={isFetchingInventory || isInventoryQueryFetching}
        onRefreshProfile={handleRefreshProfile}
        onDeleteProfile={handleDeleteProfile}
        onFetchInventory={handleFetchInventory}
        showSuccess={showSuccess}
        showError={showError}
        currentFriendIds={filteredFriends.map(friend => friend.steamId)}
      />
      
      {/* Friends List */}
      <FriendsList 
        friendsData={friendsData}
        profile={profile}
        isLoadingFriends={isLoadingFriends}
        filteredFriends={filteredFriends}
        friendFetchStatus={friendFetchStatus}
        refreshingFriends={refreshingFriends}
        searchQuery={searchQuery}
        sortOption={sortOption}
        filters={filters}
        onSearch={setSearchQuery}
        onSortChange={setSortOption}
        onFilterChange={handleFilterChange}
        onFetchFriends={handleFetchFriends}
      />
      
      {/* Confirmation Dialog for Profile Deletion */}
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDeleteProfile}
        title="Confirm Profile Deletion"
        message={`Are you sure you want to delete ${profile?.name || 'this profile'}? This action cannot be undone.`}
        confirmText="Delete Profile"
        cancelText="Cancel"
        type="danger"
      />
    </motion.div>
  );
};

export default ProfilePage;
