import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../../lib/api.js';
import { on as socketOn } from '../../lib/socket.js';

const ACTIVE_KEY = ['crawl', 'active'];

export const useCrawlActive = () => {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ACTIVE_KEY,
    queryFn: () => api.crawl.active(),
    refetchInterval: (q) => {
      const data = q?.state?.data;
      if (!data) return false;
      const hasRunning = Object.values(data).some(c => c.status === 'in_progress' || c.status === 'starting');
      return hasRunning ? 3000 : false;
    },
  });

  useEffect(() => {
    const offs = [
      socketOn('crawl:progress', (d) => {
        qc.setQueryData(ACTIVE_KEY, (prev) => ({ ...prev, [d.steamId]: d }));
      }),
      socketOn('crawl:complete', (d) => {
        qc.setQueryData(ACTIVE_KEY, (prev) => ({ ...prev, [d.steamId]: d }));
        qc.invalidateQueries({ queryKey: ['profiles', 'list'] });
      }),
      socketOn('crawl:error', (d) => {
        qc.setQueryData(ACTIVE_KEY, (prev) => ({ ...prev, [d.steamId]: d }));
      }),
    ];
    return () => offs.forEach(off => off());
  }, [qc]);

  return query;
};

export const useCrawlStart = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ steamId, options }) => api.crawl.start(steamId, options),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACTIVE_KEY }),
  });
};

export const useCrawlCancel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (steamId) => api.crawl.cancel(steamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACTIVE_KEY }),
  });
};
