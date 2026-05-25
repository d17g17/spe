import { useMemo } from 'react';
import { formatMoney } from '../../utils/format.js';

export default function FriendStatistics({ friends }) {
  const stats = useMemo(() => {
    const out = { total: friends.length, vac: 0, game: 0, trade: 0, cyrillic: 0, withInv: 0, totalInv: 0, errors: 0 };
    for (const f of friends) {
      if (f.vacBanned) out.vac++;
      if (f.gameBanned) out.game++;
      if (f.tradeBanned) out.trade++;
      if (f.hasCyrillic) out.cyrillic++;
      const inv = f.cs2Inventory;
      if (inv?.status === 'checked') {
        out.withInv++;
        out.totalInv += Number(inv.totalValueUsd) || 0;
      }
      if (inv?.status === 'error') out.errors++;
    }
    return out;
  }, [friends]);

  const Item = ({ label, value }) => (
    <div className="bg-gray-900/60 border border-gray-800 rounded-md px-3 py-2">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-gray-200 mt-0.5">{value}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
      <Item label="Total" value={stats.total} />
      <Item label="VAC" value={stats.vac} />
      <Item label="Game ban" value={stats.game} />
      <Item label="Trade ban" value={stats.trade} />
      <Item label="Cyrillic" value={stats.cyrillic} />
      <Item label="Inv. checked" value={`${stats.withInv} (${formatMoney(stats.totalInv)})`} />
      <Item label="Inv. errors" value={stats.errors} />
    </div>
  );
}
