import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export const cs2Key = (id) => ['cs2', id];

export const useCS2Inventory = (steamId) =>
  useQuery({
    queryKey: cs2Key(steamId),
    queryFn: () => api.cs2.get(steamId),
    enabled: Boolean(steamId),
    retry: 0,
  });

export const useFetchCS2 = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (steamId) => api.cs2.fetch(steamId),
    onSuccess: (data, steamId) => {
      qc.setQueryData(cs2Key(steamId), data);
      qc.invalidateQueries({ queryKey: ['profiles', 'list'] });
    },
  });
};

export const useCS2Stats = () =>
  useQuery({
    queryKey: ['cs2', 'stats'],
    queryFn: () => api.cs2.stats(),
    refetchInterval: 30_000,
  });
