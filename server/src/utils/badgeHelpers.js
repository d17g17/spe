const { formatDistanceToNowStrict } = require('date-fns');

function inventoryStatusBadge(inv) {
  if (!inv) return { label: 'INV', color: 'grey', tooltip: 'Not checked' };
  const { status, totalValueUsd, skipReason, lastChecked, has2025ServiceMedal } = inv;
  switch (status) {
    case 'checked':
      const baseLabel = `$${totalValueUsd?.toFixed?.(0) || 0}`;
      const medalIndicator = has2025ServiceMedal ? ' 🏅' : '';
      return {
        label: baseLabel + medalIndicator,
        color: totalValueUsd > 100 ? 'gold' : 'green',
        tooltip: `Inventory value: $${totalValueUsd.toFixed(2)} (checked ${formatDistanceToNowStrict(new Date(lastChecked))} ago)${has2025ServiceMedal ? ' • Contains 2025 Service Medal' : ''}`
      };
    case 'skipped':
      return {
        label: 'SKIP',
        color: 'orange',
        tooltip: `Skipped: ${skipReason}`
      };
    case 'private':
      return { label: 'PRIVATE', color: 'red', tooltip: 'Inventory private' };
    case 'empty':
      return { label: 'EMPTY', color: 'yellow', tooltip: 'No tradable items' };
    case 'error':
      return { label: 'ERROR', color: 'red', tooltip: 'Error fetching inventory' };
    default:
      // For any unrecognized status, don't return a badge at all
      // This will let the client handle it as 'not checked'
      console.warn(`Unknown inventory status: ${status}`);
      return null;
  }
}

module.exports = { inventoryStatusBadge };
