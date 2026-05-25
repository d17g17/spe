import { useCS2Inventory, useFetchCS2 } from './useCS2Inventory.js';
import { formatMoney, formatRelative } from '../../utils/format.js';
import { inventoryStatusInfo } from '../../utils/inventory.js';
import { useNotifications } from '../../state/NotificationContext.jsx';

export default function CS2InventoryCard({ steamId }) {
  const { data, isLoading } = useCS2Inventory(steamId);
  const fetchMut = useFetchCS2();
  const { success, error } = useNotifications();

  const onFetch = () => {
    fetchMut.mutate(steamId, {
      onSuccess: () => success('Inventory updated'),
      onError: (e) => error(e?.response?.data?.error || e.message),
    });
  };

  const info = data ? inventoryStatusInfo(data.status) : null;

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-md p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">CS2 Inventory</span>
          {info && <span className={`badge border ${info.color}`}>{info.label}</span>}
        </div>
        <button onClick={onFetch} disabled={fetchMut.isPending} className="btn-secondary text-xs">
          {fetchMut.isPending ? 'Checking…' : 'Refresh inventory'}
        </button>
      </div>

      {isLoading ? (
        <div className="text-xs text-gray-500">Loading…</div>
      ) : !data ? (
        <div className="text-xs text-gray-500">Never checked.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs text-gray-500">Total value</div>
              <div>{formatMoney(data.totalValueUsd)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Tradable items</div>
              <div>{data.tradableItemsCount ?? 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Total items</div>
              <div>{data.totalItemsCount ?? 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Last checked</div>
              <div>{formatRelative(data.lastChecked)}</div>
            </div>
          </div>

          {Array.isArray(data.top5TradableItems) && data.top5TradableItems.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-1">Top tradable items</div>
              <ul className="text-sm space-y-1">
                {data.top5TradableItems.map((i, idx) => (
                  <li key={idx} className="flex justify-between gap-2">
                    <span className="truncate">{i.name}</span>
                    <span className="text-gray-300 shrink-0">{formatMoney(i.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
