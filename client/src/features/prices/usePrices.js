import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export const usePriceStats = () =>
  useQuery({
    queryKey: ['prices', 'stats'],
    queryFn: () => api.prices.stats(),
  });

export const useExportPrices = () =>
  useMutation({ mutationFn: () => api.prices.export() });

export const useImportPrices = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prices) => api.prices.import(prices),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prices'] }),
  });
};

export const useClearPrices = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.prices.clear(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prices'] }),
  });
};
