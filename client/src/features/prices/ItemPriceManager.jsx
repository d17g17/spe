import { useRef, useState } from 'react';
import { usePriceStats, useExportPrices, useImportPrices, useClearPrices } from './usePrices.js';
import { useNotifications } from '../../state/NotificationContext.jsx';
import { formatRelative } from '../../utils/format.js';
import ConfirmationDialog from '../../components/ConfirmationDialog.jsx';

export default function ItemPriceManager({ onClose }) {
  const statsQ = usePriceStats();
  const exportMut = useExportPrices();
  const importMut = useImportPrices();
  const clearMut = useClearPrices();
  const { success, error, info } = useNotifications();
  const fileRef = useRef(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const doExport = async () => {
    try {
      const data = await exportMut.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prices-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      success(`Exported ${data?.prices?.length ?? 0} prices`);
    } catch (e) { error(e.message); }
  };

  const doImport = async (file) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const prices = Array.isArray(parsed) ? parsed : (parsed?.prices || []);
      const out = await importMut.mutateAsync(prices);
      success(`Imported ${out.imported} prices`);
    } catch (e) {
      error(`Import failed: ${e.message}`);
    }
  };

  const doClear = async () => {
    try {
      const out = await clearMut.mutateAsync();
      info(`Deleted ${out.deleted} prices`);
    } catch (e) {
      error(e.message);
    } finally {
      setConfirmClear(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="h-14 px-5 flex items-center justify-between border-b border-gray-800">
        <h2 className="text-base font-semibold">Item Prices</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
      </div>
      <div className="p-5 space-y-4">
        {statsQ.data && (
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Total" value={statsQ.data.total} />
            <Stat label="Cases" value={statsQ.data.cases} />
            <Stat label="24h fresh" value={statsQ.data.recent24h} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={doExport} disabled={exportMut.isPending} className="btn-secondary text-sm">
            {exportMut.isPending ? 'Exporting…' : 'Export JSON'}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={importMut.isPending} className="btn-secondary text-sm">
            {importMut.isPending ? 'Importing…' : 'Import JSON'}
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
        </div>

        <button onClick={() => setConfirmClear(true)} disabled={clearMut.isPending} className="btn-danger text-sm w-full">
          Clear all prices
        </button>

        <div className="text-xs text-gray-500">
          Prices auto-refresh during inventory checks. Cases expire after a day, others after a week.
        </div>
      </div>
      {confirmClear && (
        <ConfirmationDialog
          title="Clear all prices?"
          message="This removes every cached item price. Inventory checks will refetch them on next use."
          onConfirm={doClear}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-md px-3 py-2">
      <div className="text-xs text-gray-500 uppercase">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
