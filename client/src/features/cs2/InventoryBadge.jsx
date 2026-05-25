import { formatMoney } from '../../utils/format.js';
import { inventoryStatusInfo } from '../../utils/inventory.js';

export default function InventoryBadge({ inventory }) {
  if (!inventory) return <span className="badge bg-gray-800 text-gray-400">No CS2 data</span>;
  const info = inventoryStatusInfo(inventory.status);
  if (inventory.status === 'checked') {
    return (
      <span className={`badge border ${info.color}`}>
        CS2 · {formatMoney(inventory.totalValueUsd)}
      </span>
    );
  }
  return <span className={`badge border ${info.color}`}>CS2 · {info.label}</span>;
}
