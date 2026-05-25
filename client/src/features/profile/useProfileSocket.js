import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { on } from '../../lib/socket.js';
import { profileKey } from '../profiles/useProfiles.js';

export default function useProfileSocket(steamId) {
  const qc = useQueryClient();
  const [status, setStatus] = useState({ status: 'idle' });

  useEffect(() => {
    if (!steamId) return;
    const unsubs = [];

    unsubs.push(on(`friendFetch:${steamId}:progress`, (payload) => setStatus(payload)));
    unsubs.push(on(`friendFetch:${steamId}:complete`, (payload) => {
      setStatus(payload);
      qc.invalidateQueries({ queryKey: ['friends', steamId] });
      qc.invalidateQueries({ queryKey: ['profiles', 'list'] });
    }));
    unsubs.push(on(`friendFetch:${steamId}:error`, (payload) => setStatus(payload)));
    unsubs.push(on('inventory:update', (payload) => {
      if (payload?.steamId === steamId) {
        qc.invalidateQueries({ queryKey: ['cs2', steamId] });
        qc.invalidateQueries({ queryKey: profileKey(steamId) });
      }
      qc.invalidateQueries({ queryKey: ['friends', steamId] });
    }));

    return () => { unsubs.forEach((u) => u && u()); };
  }, [steamId, qc]);

  return status;
}
