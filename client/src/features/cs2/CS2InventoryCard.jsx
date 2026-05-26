import { useState } from 'react';
import { useCS2Inventory } from './useCS2Inventory.js';
import { formatMoney, formatRelative, formatDate } from '../../utils/format.js';
import { inventoryStatusInfo } from '../../utils/inventory.js';
import InventoryBrowser from './InventoryBrowser.jsx';
import BadgesRow from './BadgesRow.jsx';
import RareBadge from './RareBadge.jsx';
import StickerStrip, { RarityBadge, bestRarity } from './StickerStrip.jsx';

export default function CS2InventoryCard({ steamId, lastBadgeDate }) {
  const { data, isLoading } = useCS2Inventory(steamId);
  const [browsing, setBrowsing] = useState(false);

  const info = data ? inventoryStatusInfo(data.status) : null;
  const items = Array.isArray(data?.items) ? data.items : [];
  const medals = Array.isArray(data?.medals) ? data.medals : [];

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-md p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">CS2 Inventory</span>
          {info && <span className={`badge border ${info.color}`}>{info.label}</span>}
          <RareBadge inventory={data} />
        </div>
        {items.length > 0 && (
          <button onClick={() => setBrowsing((v) => !v)} className="btn-ghost text-xs">
            {browsing ? 'Hide items' : `Browse items (${items.length})`}
          </button>
        )}
      </div>

      {(medals.length > 0 || lastBadgeDate) && (
        <div className="mb-3 pb-3 border-b border-gray-800">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="shrink-0">
              <div className="text-xs text-gray-500">Last badge</div>
              <div className="text-sm">{formatDate(lastBadgeDate)}</div>
            </div>
            {medals.length > 0 && (
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500 mb-1">Medals & coins ({medals.length})</div>
                <BadgesRow badges={medals} max={3} />
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-gray-500">Loading…</div>
      ) : !data ? (
        <div className="text-xs text-gray-500">Never checked.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs text-gray-500">Total value</div>
              <div title={
                data.totalValueWithStickersUsd != null
                  && Number(data.totalValueWithStickersUsd) > Number(data.totalValueUsd)
                  ? `Including sticker prices: ${formatMoney(data.totalValueWithStickersUsd)}`
                  : undefined
              }>{formatMoney(data.totalValueUsd)}</div>
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

          {Array.isArray(data.top5TradableItems) && data.top5TradableItems.length > 0 && !browsing && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-1">Top tradable items</div>
              <ul className="text-sm space-y-1">
                {data.top5TradableItems.map((i, idx) => (
                  <ItemRow key={idx} item={i} />
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(data.notableItems) && data.notableItems.length > 0 && !browsing && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-1">Notable / rare items</div>
              <ul className="text-sm space-y-1">
                {data.notableItems.map((i, idx) => (
                  <ItemRow key={idx} item={i} />
                ))}
              </ul>
            </div>
          )}

          {browsing && items.length > 0 && (
            <InventoryBrowser items={items} onClose={() => setBrowsing(false)} />
          )}
        </>
      )}
    </div>
  );
}

function TraitTag({ trait }) {
  const map = {
    knife: { label: 'Knife', cls: 'bg-yellow-700/30 text-yellow-200 border-yellow-600/30' },
    gloves: { label: 'Gloves', cls: 'bg-yellow-700/30 text-yellow-200 border-yellow-600/30' },
    souvenir: { label: 'Souvenir', cls: 'bg-yellow-600/40 text-yellow-100 border-yellow-500/40' },
    stattrak: { label: 'StatTrak', cls: 'bg-orange-700/40 text-orange-200 border-orange-600/40' },
    pattern: { label: 'Rare pattern', cls: 'bg-rose-700/40 text-rose-200 border-rose-600/40' },
  };
  const m = map[trait];
  if (!m) return null;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${m.cls}`}>{m.label}</span>;
}

function tagsFromTraits(traits) {
  if (!traits) return [];
  const tags = [];
  if (traits.isKnife) tags.push('knife');
  if (traits.isGloves) tags.push('gloves');
  if (traits.isSouvenir) tags.push('souvenir');
  if (traits.isStatTrak) tags.push('stattrak');
  if (traits.hasRarePattern) tags.push('pattern');
  return tags;
}

function ItemRow({ item }) {
  const stickers = Array.isArray(item.stickers) ? item.stickers : [];
  const rarity = bestRarity(stickers);
  const stickerTotal = Number(item.stickerTotal || 0);
  const itemPrice = Number.isFinite(item.price) ? item.price : null;
  const qty = item.quantity || 1;
  const lineTotal = itemPrice != null ? itemPrice * qty : null;
  const lineWithStickers = lineTotal != null ? lineTotal + stickerTotal * qty : null;
  const showTotal = lineTotal != null && (qty > 1 || stickerTotal > 0);
  const tooltip = itemPrice != null
    ? stickerTotal > 0
      ? `${formatMoney(itemPrice)} item + ${formatMoney(stickerTotal)} stickers = ${formatMoney(itemPrice + stickerTotal)} each × ${qty} = ${formatMoney(lineWithStickers)}`
      : `${formatMoney(itemPrice)} × ${qty} = ${formatMoney(lineTotal)}`
    : undefined;
  const tags = tagsFromTraits(item.traits);
  return (
    <li className="flex justify-between gap-2 items-center">
      <span className="flex items-center gap-2 min-w-0">
        <span className="truncate">{item.name}</span>
        {qty > 1 && <span className="text-gray-500 text-xs">×{qty}</span>}
        {stickers.length > 0 && <StickerStrip stickers={stickers} size={18} />}
        <RarityBadge rarity={rarity} />
        {tags.map((t) => <TraitTag key={t} trait={t} />)}
      </span>
      <span
        className="shrink-0 tabular-nums text-right text-gray-300"
        title={showTotal ? tooltip : undefined}
      >
        {itemPrice == null ? <span className="text-gray-500">—</span> : formatMoney(itemPrice)}
      </span>
    </li>
  );
}
