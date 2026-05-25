import { useState } from 'react';
import {
  useBulkFetchAll, useBulkFetchAllStatus, useCancelBulkFetchAll,
} from './useProfiles.js';
import { useNotifications } from '../../state/NotificationContext.jsx';

export default function BulkFetchBar() {
  const status = useBulkFetchAllStatus();
  const startMut = useBulkFetchAll();
  const cancelMut = useCancelBulkFetchAll();
  const { info, error } = useNotifications();
  const [open, setOpen] = useState(false);
  const [concurrency, setConcurrency] = useState(4);
  const [includeCs2, setIncludeCs2] = useState(true);
  const [force, setForce] = useState(false);

  const running = status?.status === 'running';
  const pct = running && status.total
    ? Math.round((status.processed / status.total) * 100)
    : 0;

  const onStart = () => startMut.mutate(
    { concurrency, includeCs2, force },
    {
      onSuccess: (r) => info(`Refreshing ${r.total || 0} profiles…`),
      onError: (e) => error(e?.response?.data?.error || e.message),
    }
  );
  const onCancel = () => cancelMut.mutate(undefined, {
    onSuccess: () => info('Refresh cancelled'),
    onError: (e) => error(e.message),
  });

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onStart}
          disabled={running || startMut.isPending}
          className="btn-primary text-sm"
        >
          {running
            ? `Refreshing ${status.processed}/${status.total} · ${pct}%`
            : 'Refresh all profiles'}
        </button>
        {running ? (
          <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
        ) : (
          <button onClick={() => setOpen((v) => !v)} className="btn-ghost text-xs" title="Options">
            ⚙ Options
          </button>
        )}
        {status?.status === 'complete' && (
          <span className="text-xs text-gray-400">
            Last run: {status.ok} ok · {status.errors} failed
          </span>
        )}
      </div>

      {running && (
        <div>
          <div className="h-1.5 bg-gray-800 rounded overflow-hidden">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 mt-1">
            <span>
              <span className="text-emerald-300">{status.ok}</span> ok ·{' '}
              <span className="text-red-300">{status.errors}</span> fail
              {status.currentId && (
                <span className="text-gray-500 ml-2">→ {status.currentId}</span>
              )}
            </span>
            <span>{Math.round((Date.now() - status.startedAt) / 1000)}s</span>
          </div>
        </div>
      )}

      {open && !running && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800">
          <label className="text-xs text-gray-400">
            Concurrency (1-8)
            <input
              type="number"
              min={1}
              max={8}
              value={concurrency}
              onChange={(e) => setConcurrency(Math.max(1, Math.min(8, Number(e.target.value) || 4)))}
              className="input w-full mt-1 text-sm"
            />
          </label>
          <label className="text-xs text-gray-400 flex items-center gap-2 cursor-pointer self-end pb-2">
            <input type="checkbox" checked={includeCs2} onChange={(e) => setIncludeCs2(e.target.checked)} />
            Also refresh CS2 inventory
          </label>
          <label className="col-span-2 text-xs text-gray-400 flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            Force (ignore cache freshness)
          </label>
        </div>
      )}
    </div>
  );
}
