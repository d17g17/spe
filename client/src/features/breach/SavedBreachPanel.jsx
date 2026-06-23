import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useSidePanel } from '../../state/SidePanelContext.jsx';
import { useNotifications } from '../../state/NotificationContext.jsx';

// Renders breach rows that the user has previously starred for this profile.
// Pulls from the same /api/breach/cache endpoints as the side panel so the
// two views stay in sync.
export default function SavedBreachPanel({ profile }) {
  const steamId = profile?.steamId;
  const { error: toastError, success } = useNotifications();
  const { openBreach } = useSidePanel();
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);

  const cacheQuery = useQuery({
    queryKey: ['breach', 'cache', steamId],
    queryFn: () => api.breach.cacheList(steamId),
    enabled: !!steamId,
    staleTime: 30_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.breach.cacheDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['breach', 'cache', steamId] }),
    onError: (err) => toastError(err?.response?.data?.error || err.message || 'Failed to remove'),
  });

  const clearMut = useMutation({
    mutationFn: () => api.breach.cacheClearProfile(steamId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['breach', 'cache', steamId] });
      success('Cleared saved breach info');
    },
    onError: (err) => toastError(err?.response?.data?.error || err.message || 'Failed to clear'),
  });

  const entries = cacheQuery.data?.entries || [];
  if (cacheQuery.isLoading || entries.length === 0) return null;

  // Build the subject object the side panel expects so opening from here
  // shows the same "Currently inspecting" header and auto-loads the cache.
  const openInPanel = () => openBreach({
    queries: [],
    subject: {
      steamId,
      name: profile.name,
      realName: profile.realName,
      avatarUrl: profile.avatarUrl,
    },
    autoRun: false,
  });

  const bySource = new Map();
  for (const e of entries) {
    const key = e.source || 'unknown';
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(e);
  }

  return (
    <div className="card border border-amber-500/30 bg-amber-500/[0.03]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-amber-300 text-lg">★</span>
          <h3 className="text-sm font-semibold text-gray-100">Saved breach info</h3>
          <span className="text-xs text-gray-500">
            · {entries.length} record{entries.length === 1 ? '' : 's'} across {bySource.size} source{bySource.size === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={openInPanel}
            className="text-sky-300 hover:text-sky-200"
            title="Open in breach lookup panel"
          >
            Open panel
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="text-gray-400 hover:text-gray-200"
          >
            {collapsed ? 'Show' : 'Hide'}
          </button>
          <button
            type="button"
            onClick={() => clearMut.mutate()}
            disabled={clearMut.isPending}
            className="text-gray-500 hover:text-red-300"
            title="Remove every saved entry for this profile"
          >
            Clear all
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-3">
          {Array.from(bySource.entries()).map(([source, rows]) => (
            <div key={source} className="border border-amber-500/20 rounded-md overflow-hidden">
              <div className="bg-amber-500/[0.06] px-3 py-2 text-sm font-semibold text-gray-200 flex items-center justify-between">
                <span>{source}</span>
                <span className="text-xs text-gray-500">{rows.length} row{rows.length === 1 ? '' : 's'}</span>
              </div>
              <div className="divide-y divide-gray-800/70">
                {rows.map((e) => (
                  <SavedRow
                    key={e.id}
                    row={e.row}
                    onRemove={() => deleteMut.mutate(e.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SavedRow({ row, onRemove }) {
  const entries = Object.entries(row || {}).filter(([k]) => k !== 'source' && k !== 'categories');
  const categories = Array.isArray(row?.categories) ? row.categories : row?.categories ? [row.categories] : [];
  return (
    <div className="px-3 py-2 text-xs relative">
      <button
        type="button"
        onClick={onRemove}
        title="Remove from saved"
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded flex items-center justify-center text-base ring-1 ring-amber-400/40 bg-amber-500/10 text-amber-300 hover:text-amber-200 hover:bg-amber-500/20 transition-colors"
      >
        ★
      </button>
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1 pr-7">
          {categories.map((c) => (
            <span key={c} className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{c}</span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-0.5 pr-7">
        {entries.map(([k, v]) => (
          <Field key={k} k={k} v={v} />
        ))}
      </div>
    </div>
  );
}

function Field({ k, v }) {
  const display = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const copy = () => { if (display) navigator.clipboard.writeText(display).catch(() => {}); };
  return (
    <>
      <div className="text-gray-500 truncate">{k}</div>
      <div className="text-gray-200 break-all cursor-pointer hover:text-sky-300" onClick={copy} title="Click to copy">
        {display || <span className="text-gray-600">—</span>}
      </div>
    </>
  );
}
