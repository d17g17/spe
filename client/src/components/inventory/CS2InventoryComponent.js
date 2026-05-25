import React from 'react';

const statusMap = {
  unchecked: {
    label: 'CS2 Inventory has not been checked yet.',
  },
  private: {
    label: "This user's CS2 inventory is private.",
  },
  empty: {
    label: 'No priceable tradable CS2 items found.',
  },
  error: {
    label: 'Could not check inventory at this time.',
  },
};

export default function CS2InventoryComponent({ inventory, loading = false }) {
  if (loading) {
    return (
      <div className="metro-card p-4 text-center text-slate-400 flex items-center justify-center">
        <svg className="animate-spin -ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Fetching CS2 inventory...
      </div>
    );
  }

  if (!inventory) {
    return (
      <div className="metro-card p-4 text-center text-slate-400">
        {statusMap.unchecked.label}
      </div>
    );
  }

  const { status, totalValueUsd, tradableItemsCount } = inventory;

  if (status !== 'checked') {
    const info = statusMap[status] || statusMap.error;
    return (
      <div className="metro-card p-4 text-center text-slate-400">{info.label}</div>
    );
  }

  if (!totalValueUsd || totalValueUsd === 0) {
    return (
      <div className="metro-card p-4 text-center text-slate-400">
        {statusMap.empty.label}
      </div>
    );
  }

  return (
    <div className="metro-card p-4">
      <h3 className="text-xl text-white font-semibold mb-2">Tradable CS2 Inventory</h3>
      <p className="text-slate-300 mb-2">
        Total value: <span className="font-medium">${totalValueUsd.toFixed(2)}</span> USD
      </p>
      <p className="text-slate-300">
        Total tradable items: {tradableItemsCount}
      </p>
    </div>
  );
}
