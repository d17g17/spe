import { useCS2Stats } from './useCS2Inventory.js';

export default function InventoryStatsIndicator() {
  const { data } = useCS2Stats();
  if (!data) return null;
  return (
    <div className="text-xs text-gray-400 hidden md:block">
      Inv: {data.checked}/{data.total} checked · {data.private} private · {data.error} errors
    </div>
  );
}
