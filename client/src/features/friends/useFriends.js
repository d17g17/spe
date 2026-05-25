import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export const friendsKey = (id, params) => ['friends', id, params];

export const useFriends = (steamId, params = {}) =>
  useQuery({
    queryKey: friendsKey(steamId, params),
    queryFn: () => api.friends.list(steamId, params),
    enabled: Boolean(steamId),
    placeholderData: (prev) => prev,
  });
