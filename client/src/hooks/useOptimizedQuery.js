import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

/**
 * Optimized React Query hook that prevents unnecessary re-renders
 * and implements intelligent caching strategies
 */
export const useOptimizedQuery = ({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 5 * 60 * 1000, // 5 minutes default
  cacheTime = 30 * 60 * 1000, // 30 minutes default
  refetchOnWindowFocus = false,
  refetchOnMount = false,
  retry = (failureCount, error) => {
    // Don't retry on 4xx errors (client errors)
    if (error?.response?.status >= 400 && error?.response?.status < 500) {
      return false;
    }
    // Retry up to 3 times for network errors and 5xx errors
    return failureCount < 3;
  },
  retryDelay = (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff: 1s, 2s, 4s, max 30s
  select,
  onSuccess,
  onError,
  ...options
}) => {
  const queryClient = useQueryClient();
  const lastDataRef = useRef();
  const stableQueryKey = useMemo(() => queryKey, [JSON.stringify(queryKey)]);

  // Memoized query function to prevent unnecessary re-creations
  const memoizedQueryFn = useCallback(queryFn, [queryFn]);

  // Optimized select function
  const optimizedSelect = useCallback((data) => {
    if (select) {
      return select(data);
    }
    return data;
  }, [select]);

  // Memoized callbacks to prevent unnecessary re-renders
  const memoizedOnSuccess = useCallback((data) => {
    if (onSuccess) {
      onSuccess(data);
    }
  }, [onSuccess]);

  const memoizedOnError = useCallback((error) => {
    if (onError) {
      onError(error);
    }
  }, [onError]);

  const query = useQuery({
    queryKey: stableQueryKey,
    queryFn: memoizedQueryFn,
    enabled,
    staleTime,
    cacheTime,
    refetchOnWindowFocus,
    refetchOnMount,
    retry,
    retryDelay,
    select: optimizedSelect,
    onSuccess: memoizedOnSuccess,
    onError: memoizedOnError,
    ...options
  });

  // Memoized invalidation function
  const invalidateQuery = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: stableQueryKey });
  }, [queryClient, stableQueryKey]);

  // Memoized prefetch function
  const prefetchQuery = useCallback((prefetchQueryFn) => {
    return queryClient.prefetchQuery({
      queryKey: stableQueryKey,
      queryFn: prefetchQueryFn || memoizedQueryFn,
      staleTime
    });
  }, [queryClient, stableQueryKey, memoizedQueryFn, staleTime]);

  // Memoized set query data function
  const setQueryData = useCallback((updater) => {
    queryClient.setQueryData(stableQueryKey, updater);
  }, [queryClient, stableQueryKey]);

  // Return memoized result to prevent unnecessary re-renders
  return useMemo(() => ({
    ...query,
    invalidateQuery,
    prefetchQuery,
    setQueryData
  }), [
    query.data,
    query.isLoading,
    query.isError,
    query.error,
    query.isSuccess,
    query.isFetching,
    query.isStale,
    invalidateQuery,
    prefetchQuery,
    setQueryData
  ]);
};

/**
 * Hook for optimized infinite queries
 */
export const useOptimizedInfiniteQuery = ({
  queryKey,
  queryFn,
  getNextPageParam,
  enabled = true,
  staleTime = 5 * 60 * 1000,
  cacheTime = 30 * 60 * 1000,
  refetchOnWindowFocus = false,
  refetchOnMount = false,
  retry = 1,
  ...options
}) => {
  const queryClient = useQueryClient();
  const stableQueryKey = useMemo(() => queryKey, [JSON.stringify(queryKey)]);

  const memoizedQueryFn = useCallback(queryFn, [queryFn]);
  const memoizedGetNextPageParam = useCallback(getNextPageParam, [getNextPageParam]);

  const query = useInfiniteQuery({
    queryKey: stableQueryKey,
    queryFn: memoizedQueryFn,
    getNextPageParam: memoizedGetNextPageParam,
    enabled,
    staleTime,
    cacheTime,
    refetchOnWindowFocus,
    refetchOnMount,
    retry,
    ...options
  });

  const invalidateQuery = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: stableQueryKey });
  }, [queryClient, stableQueryKey]);

  return useMemo(() => ({
    ...query,
    invalidateQuery
  }), [
    query.data,
    query.isLoading,
    query.isError,
    query.error,
    query.hasNextPage,
    query.isFetchingNextPage,
    query.fetchNextPage,
    invalidateQuery
  ]);
};

/**
 * Hook for batch query invalidation
 */
export const useBatchInvalidation = () => {
  const queryClient = useQueryClient();

  const invalidateQueries = useCallback((queryKeys) => {
    const promises = queryKeys.map(queryKey => 
      queryClient.invalidateQueries({ queryKey })
    );
    return Promise.all(promises);
  }, [queryClient]);

  const invalidateByPattern = useCallback((pattern) => {
    return queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.includes(pattern);
      }
    });
  }, [queryClient]);

  return { invalidateQueries, invalidateByPattern };
};