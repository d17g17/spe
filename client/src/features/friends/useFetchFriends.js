import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export const useFetchFriends = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (steamId) => api.friends.fetch(steamId),
    onSuccess: (_, steamId) => {
      qc.invalidateQueries({ queryKey: ['friends', steamId] });
    },
  });
};
