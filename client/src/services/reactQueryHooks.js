import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import * as apiService from './api'; // Import existing API service
import { useOptimizedQuery, useBatchInvalidation } from '../hooks/useOptimizedQuery';

// Initialize and export the queryClient for external use
export const queryClient = new QueryClient();

// Query key prefixes for better organization
const KEYS = {
  PROFILE: 'profile',
  ALL_PROFILES: 'allProfiles',
  LOCAL_PROFILE: 'localProfile',
  FRIENDS: 'friends',
  PROFILE_FRIENDS: 'profileFriends',
  CS2_INVENTORY: 'cs2Inventory',
};

/**
 * Hook to fetch a Steam profile (as a query - for viewing profiles)
 * @param {string} identifier - SteamID64, vanity URL, or profile URL
 * @param {boolean} forceRefresh - Whether to force a refresh from Steam API
 */
export const useFetchProfile = (identifier, forceRefresh = false) => {
  // Use a stable query key that does NOT include the forceRefresh flag so that
  // cached profiles are reused across views.
  const baseKey = [KEYS.PROFILE, identifier];

  // Check if we already have the profile cached under the stable key
  const existingData = queryClient.getQueryData(baseKey);
  
  return useOptimizedQuery({
    queryKey: baseKey,
    queryFn: () => {
      return apiService.fetchProfile(identifier, forceRefresh);
    },
    // Fetch only if explicitly forced OR cache missing
    enabled: forceRefresh || !existingData,
    // Allow refetching when data is invalidated
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    staleTime: 2 * 60 * 1000, // 2 minutes to allow updates after friend processing
    select: (data) => {
      // Optimize profile data structure
      if (!data) return null;
      return {
        ...data,
        friendsCount: data.friendsCount || 0,
        lastLogoff: data.lastLogoff || null,
        playtime2Weeks: data.playtime2Weeks || 0
      };
    }
  });
};

/**
 * Hook to fetch a Steam profile (as a mutation - for profile search form)
 */
export const useFetchProfileMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ identifier, forceRefresh }) => apiService.fetchProfile(identifier, forceRefresh),
    onSuccess: (data) => {
      // Update the profile in the cache
      queryClient.setQueryData([KEYS.PROFILE, data.steamId], data);
      // Invalidate all queries that start with ALL_PROFILES to catch all variations
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === KEYS.ALL_PROFILES;
        }
      });
    },
  });
};

/**
 * Hook to get a specific profile from local database
 * @param {string} steamId - SteamID64
 */
export const useLocalProfile = (steamId) => {
  return useQuery({
    queryKey: [KEYS.LOCAL_PROFILE, steamId],
    queryFn: () => apiService.getLocalProfile(steamId),
    enabled: !!steamId,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to fetch all locally stored profiles with server-side filtering and sorting
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - Sort order ('ASC' or 'DESC')
 * @param {number} limit - Maximum number of profiles to return
 * @param {number} offset - Pagination offset
 * @param {Object} filters - Filter criteria to apply server-side
 * @param {string} searchQuery - Text search query to apply server-side
 * @param {Object} options - Additional React Query options
 */
export const useAllProfiles = (
  sortBy = 'updatedAt', 
  sortOrder = 'DESC', 
  limit = 100, 
  offset = 0,
  filters = {},
  searchQuery = '',
  options = {}
) => {
  // Create stable filter key by stringifying filters object
  const filtersKey = JSON.stringify(filters);
  
  return useOptimizedQuery({
    queryKey: [KEYS.ALL_PROFILES, sortBy, sortOrder, limit, offset, filtersKey, searchQuery],
    queryFn: () => apiService.getAllProfiles(sortBy, sortOrder, limit, offset, filters, searchQuery),
    refetchOnWindowFocus: true,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    select: (data) => {
      // Optimize profiles data structure
      if (!data || !data.profiles) return { profiles: [], totalCount: 0 };
      return {
        ...data,
        profiles: data.profiles.map(profile => ({
          ...profile,
          friendsCount: profile.friendsCount || 0,
          lastLogoff: profile.lastLogoff || null,
          cs2Inventory: profile.cs2Inventory || null
        }))
      };
    },
    ...options
  });
};

/**
 * Hook to delete a profile from local cache
 */
export const useDeleteProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (steamId) => apiService.deleteLocalProfile(steamId),
    onSuccess: (_, steamId) => {
      // Invalidate individual profile queries
      queryClient.invalidateQueries({ queryKey: [KEYS.PROFILE, steamId] });
      queryClient.invalidateQueries({ queryKey: [KEYS.LOCAL_PROFILE, steamId] });
      // Invalidate all queries that start with ALL_PROFILES to catch all variations
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === KEYS.ALL_PROFILES;
        }
      });
    },
  });
};

/**
 * Hook to delete all profiles from local cache
 */
export const useDeleteAllProfiles = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => apiService.deleteAllLocalProfilesApi(),
    onSuccess: () => {
      // Invalidate all profile-related queries using predicate to catch all variations
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === KEYS.ALL_PROFILES;
        }
      });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === KEYS.PROFILE;
        }
      });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === KEYS.LOCAL_PROFILE;
        }
      });
    },
  });
};

/**
 * Hook to trigger friend fetch for a profile
 */
export const useFetchFriends = () => {
  return useMutation({
    mutationFn: (steamId) => apiService.triggerFriendFetch(steamId),
  });
};

/**
 * Hook to get cached friends of a profile
 * @param {string} steamId - SteamID64 of the profile to get friends for
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of friends to return (use 0 for all friends)
 * @param {number} options.offset - Pagination offset
 * @param {string} options.sortBy - Field to sort by
 * @param {string} options.sortOrder - Sort direction ('ASC' or 'DESC')
 * @param {boolean} options.enabled - Whether the query is enabled
 * @param {boolean} options.useCachedOnly - Whether to only use cached friends
 */
export const useProfileFriends = (steamId, options = {}) => {
  // Setting a higher default limit (1000) to fetch all friends at once
  // This is more efficient than multiple paginated requests for most cases
  const { 
    limit = 1000, 
    offset = 0, 
    sortBy = 'name', 
    sortOrder = 'ASC',
    enabled = true,
    useCachedOnly = false
  } = options;
  
  return useOptimizedQuery({
    queryKey: [KEYS.PROFILE_FRIENDS, steamId, limit, offset, sortBy, sortOrder, useCachedOnly],
    queryFn: () => {
      return apiService.getProfileFriends(steamId, { 
        limit, 
        offset, 
        sortBy, 
        sortOrder,
        useCachedOnly 
      });
    },
    enabled: !!steamId && enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes to allow more frequent updates
    refetchOnMount: 'always',  // Always refetch on mount to ensure fresh data
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    select: (data) => {
      // Optimize friends data structure
      if (!data) return { friends: [], pagination: { total: 0, totalPages: 0 } };
      return {
        ...data,
        friends: data.friends?.map(friend => ({
          ...friend,
          cs2Inventory: friend.cs2Inventory || null,
          friendsCount: friend.friendsCount || 0
        })) || []
      };
    }
  });
};

/**
 * Hook to get cached CS2 inventory data for a profile
 */
export const useCS2Inventory = (steamId) => {
  return useOptimizedQuery({
    queryKey: [KEYS.CS2_INVENTORY, steamId],
    queryFn: () => apiService.getCS2Inventory(steamId),
    enabled: !!steamId,
    staleTime: 2 * 60 * 1000, // 2 minutes to allow updates after inventory checks
    refetchOnMount: 'always', // Always refetch on mount to ensure fresh data
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    select: (data) => {
      // Optimize inventory data structure
      if (!data) return null;
      return {
        ...data,
        totalValueUsd: data.totalValueUsd || 0,
        tradableItemsCount: data.tradableItemsCount || 0,
        top5TradableItems: data.top5TradableItems || []
      };
    }
  });
};
