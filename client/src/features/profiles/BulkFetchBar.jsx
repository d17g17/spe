import { useState, useEffect, useRef } from 'react';
import {
  useBulkFetchAll, useBulkFetchAllStatus, useCancelBulkFetchAll,
} from './useProfiles.js';
import { useNotifications } from '../../state/NotificationContext.jsx';
import BulkResultDialog from '../../components/BulkResultDialog.jsx';
import { speedPercent } from '../../utils/concurrency.js';

export default function BulkFetchBar({ sortBy, sortDir, filters, search } = {}) {
  const status = useBulkFetchAllStatus();
  const startMut = useBulkFetchAll();
  const cancelMut = useCancelBulkFetchAll();
  const { info, error } = useNotifications();
  const [open, setOpen] = useState(false);
  const [concurrency, setConcurrency] = useState(4);
  const [adaptive, setAdaptive] = useState(false);
  const [includeCs2, setIncludeCs2] = useState(true);
  const [force, setForce] = useState(false);
  const [report, setReport] = useState(null);
  const prevStatus = useRef(status?.status);

  useEffect(() => {
    const prev = prevStatus.current;
    const cur = status?.status;
    if (prev === 'running' && (cur === 'complete' || cur === 'cancelled' || cur === 'error')) {
      setReport({
        title: cur === 'cancelled' ? 'Refresh cancelled' : 'Refresh complete',
        summary: `${status.ok || 0} ok · ${status.errors || 0} failed · ${status.processed || 0}/${status.total || 0} processed`,
        errors: Array.isArray(status.errorLog) ? status.errorLog : [],
      });
    }
    prevStatus.current = cur;
  }, [status?.status, status?.ok, status?.errors, status?.processed, status?.total, status?.errorLog]);

  const running = status?.status === 'running';
  const pct = running && status.total
    ? Math.round((status.processed / status.total) * 100)
    : 0;

  const onStart = () => startMut.mutate(
    { concurrency, adaptive, includeCs2, force, sortBy, sortDir, filters, search },
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
          <>
            <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
            {status.adaptive && (
              <span
                className="text-xs px-2 py-1 rounded border bg-emerald-700/30 border-emerald-500/60 text-emerald-200 font-semibold tabular-nums"
                title={`Adaptive concurrency · ${status.concurrency} workers (12 = 100%, 20 = 200%)`}
              >
                ⚡ Adaptive · {speedPercent(status.concurrency)}% · {status.concurrency}
              </span>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setAdaptive((v) => !v)}
              className={`text-xs px-2 py-1 rounded border ${adaptive
                ? 'bg-emerald-700/30 border-emerald-500/60 text-emerald-200'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}
              title="Auto-tune concurrency. Speeds up when stable, backs off on rate limits."
            >
              {adaptive ? '⚡ Adaptive' : 'Adaptive: off'}
            </button>
            <label
              className={`text-xs text-gray-400 flex items-center gap-2 ${adaptive ? 'opacity-50' : ''}`}
              title={adaptive
                ? 'Disabled while Adaptive is on'
                : 'Number of profiles to fetch in parallel (1-20)'}
            >
              <span>Concurrency</span>
              <input
                type="range"
                min={1}
                max={20}
                value={concurrency}
                disabled={adaptive}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="w-28 accent-sky-500 disabled:cursor-not-allowed"
              />
              <span className="text-gray-200 tabular-nums w-5 text-center">{concurrency}</span>
            </label>
            <button onClick={() => setOpen((v) => !v)} className="btn-ghost text-xs" title="More options">
              ⚙
            </button>
          </>
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
          <label className="text-xs text-gray-400 flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includeCs2} onChange={(e) => setIncludeCs2(e.target.checked)} />
            Also refresh CS2 inventory
          </label>
          <label className="text-xs text-gray-400 flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            Force (ignore cache freshness)
          </label>
        </div>
      )}
      {report && (
        <BulkResultDialog
          title={report.title}
          summary={report.summary}
          errors={report.errors}
          onClose={() => setReport(null)}
        />
      )}
    </div>
  );
}
