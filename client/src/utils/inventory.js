export const INVENTORY_STATUS = {
  checked: { label: 'Checked', color: 'bg-emerald-700/40 text-emerald-200 border-emerald-600/40' },
  private: { label: 'Private', color: 'bg-amber-700/40 text-amber-200 border-amber-600/40' },
  empty: { label: 'Empty', color: 'bg-gray-700/40 text-gray-300 border-gray-600/40' },
  error: { label: 'Error', color: 'bg-red-700/40 text-red-200 border-red-600/40' },
  skipped: { label: 'Skipped', color: 'bg-gray-700/40 text-gray-300 border-gray-600/40' },
};

export const inventoryStatusInfo = (s) => INVENTORY_STATUS[s] || { label: s || 'Unknown', color: 'bg-gray-700/40 text-gray-300 border-gray-600/40' };
