import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../../lib/api.js';
import { on as socketOn } from '../../lib/socket.js';

const KEY = ['proxies', 'list'];
const TEST_KEY = ['proxyTestRun'];

export const useProxies = () =>
  useQuery({
    queryKey: KEY,
    queryFn: () => api.proxies.list(),
    refetchInterval: 15_000,
  });

export const useSetProxy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }) => api.proxies.setOne(id, enabled),
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData(KEY);
      if (prev?.webshare?.proxies) {
        qc.setQueryData(KEY, {
          ...prev,
          webshare: {
            ...prev.webshare,
            enabled: prev.webshare.enabled + (enabled ? 1 : -1) * (prev.webshare.proxies.find((p) => p.id === id)?.enabled !== enabled ? 1 : 0),
            proxies: prev.webshare.proxies.map((p) => (p.id === id ? { ...p, enabled } : p)),
          },
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(KEY, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useSetAllProxies = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled) => api.proxies.setAll(enabled),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useReloadProxies = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.proxies.reload(),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useClearProxyHealth = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.proxies.clearHealth(),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useKeepWorking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.proxies.keepWorking(),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useRemoveDead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.proxies.removeDead(),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useSetProxiesGlobal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled) => api.proxies.setGlobal(enabled),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useTestProxies = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts = {}) => api.proxies.testAll(opts),
    onSuccess: (r) => {
      if (r && (r.status === 'running' || r.started)) {
        qc.setQueryData(TEST_KEY, { ...r, status: 'running' });
      }
    },
  });
};

export const useCancelTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.proxies.testCancel(),
    onSuccess: (r) => qc.setQueryData(TEST_KEY, r),
  });
};

export const useTestProxy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.proxies.testOne(id),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useImportProxies = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text) => api.proxies.importText(text),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useProxyTestStatus = () => {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: TEST_KEY,
    queryFn: () => api.proxies.testStatus(),
    refetchInterval: (q) => (q?.state?.data?.status === 'running' ? 1500 : false),
    staleTime: Infinity,
  });

  useEffect(() => {
    const offProgress = socketOn('proxies:testProgress', (s) => qc.setQueryData(TEST_KEY, s));
    const offDone = socketOn('proxies:testDone', (s) => {
      qc.setQueryData(TEST_KEY, s);
      qc.invalidateQueries({ queryKey: KEY });
    });
    return () => { offProgress(); offDone(); };
  }, [qc]);

  return query.data;
};
