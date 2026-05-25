import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { on } from '../../lib/socket.js';

export const useBulkInventoryStatus = (ownerId) =>
  useQuery({
    queryKey: ['cs2', 'bulk', ownerId],
    queryFn: () => api.cs2.bulkStatus(ownerId),
    enabled: Boolean(ownerId),
    refetchInterval: 5000,
  });

export const useStartBulkInventory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ownerId, force = false, concurrency, adaptive = false }) =>
      api.cs2.bulkStart(ownerId, force, concurrency, adaptive),
    onSuccess: (_data, { ownerId }) => {
      qc.invalidateQueries({ queryKey: ['cs2', 'bulk', ownerId] });
    },
  });
};

export const useBulkInventorySocket = (ownerId) => {
  const qc = useQueryClient();
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!ownerId) return undefined;
    const unsubs = [];
    unsubs.push(on(`bulkCs2:${ownerId}:progress`, (data) => {
      if (data?.ownerId !== ownerId) return;
      setProgress(data);
      qc.setQueryData(['cs2', 'bulk', ownerId], (prev) => ({ ...(prev || {}), ...data }));
    }));
    unsubs.push(on(`bulkCs2:${ownerId}:complete`, (data) => {
      if (data?.ownerId !== ownerId) return;
      setProgress(data);
      qc.invalidateQueries({ queryKey: ['cs2', 'bulk', ownerId] });
      qc.invalidateQueries({ queryKey: ['friends', ownerId] });
      qc.invalidateQueries({ queryKey: ['profiles', 'list'] });
    }));
    unsubs.push(on('inventory:update', (data) => {
      if (!data?.steamId) return;
      qc.setQueryData(['cs2', data.steamId], data.inventory);
    }));
    return () => { unsubs.forEach((u) => u && u()); };
  }, [ownerId, qc]);

  return progress;
};
