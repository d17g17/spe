import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { fetchProfile } from '../services/api';
import { queryClient } from '../services/reactQueryHooks';

/**
 * Custom hook for fetching Steam profiles
 * Returns a mutation for fetching profiles and relevant state
 */
export const useProfileFetch = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Create the mutation
  const mutation = useMutation({
    mutationFn: async ({ identifier, forceRefresh = false }) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchProfile(identifier, forceRefresh);
        return result;
      } catch (err) {
        setError(err.message || 'Failed to fetch profile');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries(['profile', data.steamId]);
      queryClient.invalidateQueries(['allProfiles']);
      
      // Update the cache
      queryClient.setQueryData(['profile', data.steamId], data);
    }
  });
  
  return {
    fetchProfile: mutation.mutateAsync,
    isLoading: isLoading || mutation.isLoading,
    error: error || mutation.error,
    reset: () => {
      setError(null);
      mutation.reset();
    }
  };
};

export default useProfileFetch;
