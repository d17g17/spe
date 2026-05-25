import { useMemo, useState } from 'react';
import { formatMoney } from '../../utils/format.js';

const SORTS = [
  { value: 'price:DESC', label: 'Price (high→low)' },
  { value: 'price:ASC', label: 'Price (low→high)' },
  { value: 'totalPrice:DESC', label: 'Total value (high→low)' },
  { value: 'volume:DESC', label: 'Volume (most traded)' },
  { value: 'volume:ASC', label: 'Volume (least traded)' },
  { value: 'quantity:DESC', label: 'Quantity (most owned)' },
  { value: 'name:ASC', label: 'Name (A→Z)' },
];

const ICON_BASE = 'https://community.cloudflare.steamstatic.com/economy/image/';

export default function InventoryBrowser({ items, onClose }) {
  const [sort, setSort] = useState('price:DESC');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (!Array.isArray(items)) return [];
    const term = search.trim().toLowerCase();
    let out = items.filter((i) => {
      if (filter === 'tradable' && !i.tradable) return false;
      if (filter === 'untradable' && i.tradable) return false;
      if (filter === 'priced' && !Number.isFinite(i.price)) return false;
      if (term && !(i.name || '').toLowerCase().includes(term)) return false;
      return true;
    });
    const [k, dir] = sort.split(':');
    const sign = dir === 'ASC' ? 1 : -1;
    out.sort((a, b) => {
      const av = a[k];
      const bv = b[k];
      if (typeof av === 'string' || typeof bv === 'string') {
        return sign * String(av ?? '').localeCompare(String(bv ?? ''));
      }
      return sign * ((av ?? -Infinity) - (bv ?? -Infinity));
    });
    return out;
  }, [items, search, sort, filter]);

  const totals = useMemo(() => {
    let value = 0;
    let count = 0;
    for (const i of filtered) {
      if (Number.isFinite(i.totalPrice)) value += i.totalPrice;
      count += i.quantity || 1;
    }
    return { value, count };
  }, [filtered]);

  return (
    <div className="card mt-3">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h3 className="text-base font-semibold">
          Inventory ({filtered.length} unique · {totals.count} items · {formatMoney(totals.value)})
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-sm">Hide ✕</button>
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items…"
          className="input flex-1 min-w-[200px]"
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input w-40">
          <option value="all">All items</option>
          <option value="tradable">Tradable only</option>
          <option value="untradable">Untradable only</option>
          <option value="priced">Priced only</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="input w-56">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">No items match.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-800">
              <tr>
                <th className="text-left py-2 px-2">Item</th>
                <th className="text-right py-2 px-2">Qty</th>
                <th className="text-right py-2 px-2">Price</th>
                <th className="text-right py-2 px-2">Total</th>
                <th className="text-right py-2 px-2">Volume</th>
                <th className="text-center py-2 px-2">Tradable</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i, idx) => (
                <tr key={`${i.name}-${idx}`} className="border-b border-gray-900 hover:bg-gray-800/30">
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {i.icon ? (
                        <img
                          src={`${ICON_BASE}${i.icon}/64fx64f`}
                          alt=""
                          className="w-8 h-8 rounded bg-gray-800 shrink-0"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-800 shrink-0" />
                      )}
                      <span className="truncate">{i.name}</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2 text-right text-gray-300">{i.quantity || 1}</td>
                  <td className="py-1.5 px-2 text-right">{Number.isFinite(i.price) ? formatMoney(i.price) : '—'}</td>
                  <td className="py-1.5 px-2 text-right text-emerald-300">{Number.isFinite(i.totalPrice) ? formatMoney(i.totalPrice) : '—'}</td>
                  <td className="py-1.5 px-2 text-right text-gray-400">{i.volume ? i.volume.toLocaleString() : '—'}</td>
                  <td className="py-1.5 px-2 text-center">
                    {i.tradable
                      ? <span className="badge bg-emerald-700/30 text-emerald-200 text-[10px]">✓</span>
                      : <span className="badge bg-gray-700/40 text-gray-400 text-[10px]">✕</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
