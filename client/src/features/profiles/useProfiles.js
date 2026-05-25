import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

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
    mutationFn: ({ id, force = false }) => api.profiles.fetch(id, force),
    onSuccess: (data) => {
      const id = data?.profile?.steamId;
      if (id) {
        qc.setQueryData(profileKey(id), data.profile);
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

export const useDeleteAllProfiles = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.profiles.deleteAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });
};
