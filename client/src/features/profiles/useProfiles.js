import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../../lib/api.js';
import { cs2Key } from '../cs2/useCS2Inventory.js';
import { on as socketOn } from '../../lib/socket.js';

const BULK_KEY = ['profiles', 'bulkAll'];

export const profilesKey = (params) => ['profiles', 'list', params];
export const profileKey = (id) => ['profiles', 'one', id];

export const useProfilesList = (params) =>
  useQuery({
    queryKey: profilesKey(params),
    queryFn: () => api.profiles.list(params),
    placeholderData: (prev) => prev,
  });

export const useProfile = (id) =>
  useQuery({
    queryKey: profileKey(id),
    queryFn: () => api.profiles.get(id),
    enabled: Boolean(id),
    retry: 0,
  });

export const useFetchProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force = false, inventory = false }) =>
      api.profiles.fetch(id, force, { inventory }),
    onSuccess: (data) => {
      const id = data?.profile?.steamId;
      if (id) {
        qc.setQueryData(profileKey(id), data.profile);
        if (data.inventory) qc.setQueryData(cs2Key(id), data.inventory);
      }
      qc.invalidateQueries({ queryKey: ['profiles', 'list'] });
    },
  });
};

export const useDeleteProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.profiles.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles', 'list'] }),
  });
};

export const useIgnoreProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ignored }) => api.profiles.setIgnored(id, ignored),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });
};

export const useDeleteAllProfiles = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.profiles.deleteAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });
};

export const useBulkFetchAll = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts = {}) => api.profiles.fetchAllStart(opts),
    onSuccess: (r) => {
      if (r && r.status === 'running') qc.setQueryData(BULK_KEY, r);
    },
  });
};

export const useCancelBulkFetchAll = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.profiles.fetchAllCancel(),
    onSuccess: (r) => qc.setQueryData(BULK_KEY, r),
  });
};

export const useBulkFetchAllStatus = () => {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: BULK_KEY,
    queryFn: () => api.profiles.fetchAllStatus(),
    refetchInterval: (q) => (q?.state?.data?.status === 'running' ? 2000 : false),
    staleTime: Infinity,
  });

  useEffect(() => {
    const off = socketOn('bulkAll:progress', (s) => {
      qc.setQueryData(BULK_KEY, s);
      if (s.status === 'complete' || s.status === 'cancelled' || s.status === 'error') {
        qc.invalidateQueries({ queryKey: ['profiles', 'list'] });
      }
    });
    return () => off();
  }, [qc]);

  return query.data;
};
