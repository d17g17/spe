import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '../../lib/api.js';
import { useNotifications } from '../../state/NotificationContext.jsx';
import { useSidePanel } from '../../state/SidePanelContext.jsx';
import usePersistedState from '../../utils/usePersistedState.js';

const ALL_FIELDS = [
  'steamid', 'email', 'username', 'password', 'name',
  'phone', 'ip', 'domain', 'discordid', 'uuid',
];

// Per-query hard timeout. The server caps at 30s; we give a tiny grace and then
// cancel from the client so a single hung query never blocks the UI.
const QUERY_TIMEOUT_MS = 25_000;

// Stable JSON encoding (sorted keys) so two equal rows produce the same key
// regardless of property order. Used to match search results against cached
// entries client-side.
const stableJson = (obj) => {
  if (!obj || typeof obj !== 'object') return JSON.stringify(obj);
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  return JSON.stringify(sorted);
};

export default function BreachSearch({ onClose }) {
  const { error: toastError, info } = useNotifications();
  const { breachRequest } = useSidePanel();
  const qc = useQueryClient();

  const [term, setTerm] = useState('');
  // Default: every field is on. User can turn individual ones off and the
  // selection is persisted in localStorage. Key bumped to v2 so existing
  // sessions with the old `['steamid']`-only default get the new behavior.
  const [fields, setFields] = usePersistedState('breach.fields.v2', ALL_FIELDS);
  const [wildcard, setWildcard] = usePersistedState('breach.wildcard', false);
  const [caseSensitive, setCaseSensitive] = usePersistedState('breach.caseSensitive', false);
  const [results, setResults] = useState(null);
  const [lastQuery, setLastQuery] = useState(null);
  const [subject, setSubject] = useState(null);
  const [filter, setFilter] = useState('');
  // Cached breach rows linked to the current subject's profile. Loaded from
  // the server when a subject is set so the user can see what they've saved
  // before re-running any queries.
  const [cached, setCached] = useState([]);
  // Most recent fields override coming from an external openBreach() call.
  // Lets us submit with the exact fields the caller asked for, even if the
  // persisted `fields` state hasn't re-rendered yet.
  const pendingFieldsRef = useRef(null);
  // Track the last consumed openBreach() nonce so re-mounting the panel
  // (e.g. after closing and re-opening manually) doesn't replay an old search.
  const lastSeenNonceRef = useRef(null);

  // Map stableJson(row) -> cached entry id, so search-result rows can show
  // whether they're already saved and we can delete by id on a single click.
  const cachedByKey = useMemo(() => {
    const m = new Map();
    for (const e of cached) m.set(stableJson(e.row), e.id);
    return m;
  }, [cached]);

  // Progressive search state. Each query fires independently, results stream
  // in as they arrive, and a per-query AbortController plus client-side timeout
  // ensures no single hung query can lock the UI.
  const [pending, setPending] = useState(0); // queries still in-flight
  const [total, setTotal] = useState(0); // total queries in the current run
  const runIdRef = useRef(0); // monotonic id; stale results from prior runs are dropped
  const abortersRef = useRef([]); // AbortControllers for the current run
  const seenRowsRef = useRef(new Set()); // dedup across queries in a run
  const isSearching = pending > 0;

  // Cancel all in-flight queries for the current run. Bumps runId so any
  // late settlements are ignored entirely.
  const cancelAll = useCallback(() => {
    runIdRef.current += 1;
    for (const c of abortersRef.current) { try { c.abort(); } catch (_) { /* ignore */ } }
    abortersRef.current = [];
    setPending(0);
  }, []);

  // Kick off a fresh batch of queries. Updates state as each one settles.
  const runQueries = useCallback((queries, { wildcard, caseSensitive }) => {
    cancelAll();
    const runId = ++runIdRef.current;
    seenRowsRef.current = new Set();
    setResults([]);
    setLastQuery({ queries });
    setTotal(queries.length);
    setPending(queries.length);

    let rateLimited = false;
    let timedOut = false;
    const errors = [];

    queries.forEach((q) => {
      const controller = new AbortController();
      abortersRef.current.push(controller);
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, QUERY_TIMEOUT_MS);

      api.breach
        .search(
          { term: q.term, fields: q.fields, wildcard, caseSensitive },
          { signal: controller.signal }
        )
        .then((data) => {
          if (runId !== runIdRef.current) return; // stale
          const rows = Array.isArray(data?.results) ? data.results : [];
          if (rows.length) {
            const seen = seenRowsRef.current;
            const fresh = [];
            for (const row of rows) {
              const k = JSON.stringify(row);
              if (seen.has(k)) continue;
              seen.add(k);
              fresh.push(row);
            }
            if (fresh.length) setResults((cur) => (cur ? [...cur, ...fresh] : fresh));
          }
        })
        .catch((err) => {
          if (runId !== runIdRef.current) return; // stale
          if (axios.isCancel?.(err) || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
            // either we aborted on timeout (already flagged) or a newer run started
            return;
          }
          const status = err?.response?.status;
          if (status === 429) rateLimited = true;
          errors.push({ q, msg: err?.response?.data?.error || err.message });
        })
        .finally(() => {
          clearTimeout(timer);
          if (runId !== runIdRef.current) return;
          setPending((p) => {
            const next = p - 1;
            if (next === 0) {
              // Run completed. Surface any aggregate issues to the user.
              if (rateLimited) toastError('Rate limited on one or more queries (15 req/min)');
              else if (timedOut) toastError(`One or more queries timed out after ${QUERY_TIMEOUT_MS / 1000}s · showing partial results`);
              else if (errors.length) toastError(`Some queries failed: ${errors.map((e) => e.msg).join('; ')}`);
              else {
                // Read current results synchronously off state at next tick; here use a
                // microtask via setResults callback hack: check the dedup set instead.
                if (seenRowsRef.current.size === 0) info('No breach records found');
              }
            }
            return next;
          });
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abort any in-flight queries when the panel unmounts.
  useEffect(() => () => cancelAll(), [cancelAll]);

  // Reload cached entries for the current subject. Used after save/delete and
  // whenever a new subject arrives.
  const reloadCache = async (steamId) => {
    if (!steamId) { setCached([]); return; }
    try {
      const data = await api.breach.cacheList(steamId);
      setCached(Array.isArray(data?.entries) ? data.entries : []);
    } catch (err) {
      toastError(err?.response?.data?.error || err.message || 'Failed to load cached breach data');
    }
  };

  const saveMut = useMutation({
    mutationFn: ({ profileId, items }) => api.breach.cacheSave(profileId, items),
    onSuccess: (data, vars) => {
      if (Array.isArray(data?.entries)) setCached(data.entries);
      qc.invalidateQueries({ queryKey: ['breach', 'cache', vars.profileId] });
    },
    onError: (err) => toastError(err?.response?.data?.error || err.message || 'Failed to save'),
  });

  const deleteMut = useMutation({
    mutationFn: ({ id }) => api.breach.cacheDelete(id),
    onSuccess: (_d, vars) => {
      setCached((cur) => cur.filter((e) => e.id !== vars.id));
      if (subject?.steamId) qc.invalidateQueries({ queryKey: ['breach', 'cache', subject.steamId] });
    },
    onError: (err) => toastError(err?.response?.data?.error || err.message || 'Failed to remove'),
  });

  // Toggle the saved state of a single row. If the row's stable key matches a
  // cached entry, delete it; otherwise save it under the current subject.
  const toggleCache = (row, source) => {
    if (!subject?.steamId) return;
    const key = stableJson(row);
    const existingId = cachedByKey.get(key);
    if (existingId) {
      deleteMut.mutate({ id: existingId });
    } else {
      saveMut.mutate({
        profileId: subject.steamId,
        items: [{ source: source || row.source || 'unknown', row }],
      });
    }
  };

  const clearAllCache = async () => {
    if (!subject?.steamId) return;
    try {
      await api.breach.cacheClearProfile(subject.steamId);
      setCached([]);
      qc.invalidateQueries({ queryKey: ['breach', 'cache', subject.steamId] });
    } catch (err) {
      toastError(err?.response?.data?.error || err.message || 'Failed to clear');
    }
  };

  // External openBreach({ queries, subject, autoRun }) requests. Each carries
  // a fresh `nonce` so re-requesting the same lookup still triggers a run.
  // Intentionally does NOT push the queries' term/fields into the manual
  // search form -- the form stays free for the user to type their own query.
  useEffect(() => {
    if (!breachRequest) return;
    if (breachRequest.nonce === lastSeenNonceRef.current) return;
    lastSeenNonceRef.current = breachRequest.nonce;
    setSubject(breachRequest.subject || null);
    setFilter('');
    // Auto-load anything we've cached for this profile so the user can see
    // saved breach info without having to re-run the lookup.
    reloadCache(breachRequest.subject?.steamId);
    const queries = (breachRequest.queries || [])
      .map((q) => ({
        term: (q.term ?? '').toString().trim(),
        fields: Array.isArray(q.fields) && q.fields.length ? q.fields : null,
      }))
      .filter((q) => q.term);
    if (queries.length === 0 || breachRequest.autoRun === false) return;
    const normalized = queries.map((q) => ({ term: q.term, fields: q.fields || fields }));
    runQueries(normalized, { wildcard, caseSensitive });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breachRequest?.nonce]);

  const toggleField = (f) => {
    setFields((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    // Comma-separate the input into multiple search terms. Each piece gets
    // searched against the currently selected fields as its own query.
    const manualTerms = (term || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (manualTerms.length === 0) {
      toastError('Enter a search term');
      return;
    }
    if (fields.length === 0) {
      toastError('Pick at least one field');
      return;
    }
    const queries = manualTerms.map((t) => ({ term: t, fields }));
    runQueries(queries, { wildcard, caseSensitive });
  };

  const reset = () => {
    cancelAll();
    setResults(null);
    setLastQuery(null);
    setSubject(null);
    setFilter('');
    setCached([]);
    setPending(0);
    setTotal(0);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="h-14 px-5 flex items-center justify-between border-b border-gray-800">
        <div>
          <h2 className="text-base font-semibold">Breach lookup</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
      </div>

      {subject && <SubjectBar subject={subject} />}

      <form onSubmit={onSubmit} className="p-5 space-y-3 border-b border-gray-800">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Search term</label>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="user@example.com, 76561198000000000, JohnDoe"
            className="w-full bg-gray-800/70 border border-gray-700 rounded-md px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <p className="text-[10px] text-gray-600 mt-1">Comma-separate to search multiple terms at once.</p>
        </div>

        <div>
          <div className="text-xs text-gray-400 mb-1">Fields to match</div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_FIELDS.map((f) => {
              const on = fields.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleField(f)}
                  className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                    on
                      ? 'bg-sky-600/30 border-sky-500 text-sky-200'
                      : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-400">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={wildcard} onChange={(e) => setWildcard(e.target.checked)} />
            Wildcard (<code className="text-gray-500">* ?</code>)
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
            Case sensitive
          </label>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={isSearching || !term.trim() || fields.length === 0}
            className="btn-primary text-sm px-4"
          >
            {isSearching ? `Searching ${total - pending}/${total}…` : 'Search'}
          </button>
          {isSearching && (
            <button type="button" onClick={cancelAll} className="btn-ghost text-sm" title="Cancel in-flight queries">Cancel</button>
          )}
          {results && !isSearching && (
            <button type="button" onClick={reset} className="btn-ghost text-sm">Clear</button>
          )}
        </div>
      </form>

      {(results?.length > 0 || cached.length > 0) && (
        <div className="px-5 py-2 border-b border-gray-800">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filter ${(results?.length || 0) + cached.length} record${(results?.length || 0) + cached.length === 1 ? '' : 's'}…`}
            className="w-full bg-gray-800/70 border border-gray-700 rounded-md px-3 py-1.5 text-xs outline-none focus:border-sky-500"
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {subject && cached.length > 0 && (
          <SavedSection
            cached={cached}
            filter={filter}
            onDelete={(id) => deleteMut.mutate({ id })}
            onClearAll={clearAllCache}
          />
        )}
        <BreachResults
          results={results}
          query={lastQuery}
          loading={isSearching && (!results || results.length === 0)}
          progress={isSearching ? { done: total - pending, total } : null}
          filter={filter}
          canCache={!!subject?.steamId}
          cachedByKey={cachedByKey}
          onToggleCache={toggleCache}
        />
      </div>
    </div>
  );
}

function SavedSection({ cached, filter, onDelete, onClearAll }) {
  const needle = (filter || '').trim().toLowerCase();
  const filtered = needle
    ? cached.filter(({ row }) => Object.values(row || {}).some((v) => {
        if (v == null) return false;
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return s.toLowerCase().includes(needle);
      }))
    : cached;
  if (filtered.length === 0 && needle) return null;

  const bySource = new Map();
  for (const e of filtered) {
    const key = e.source || 'unknown';
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(e);
  }

  return (
    <div className="p-5 pb-3 space-y-3 border-b border-gray-800 bg-amber-500/[0.03]">
      <div className="flex items-center justify-between text-xs">
        <div className="text-amber-300/90 font-semibold flex items-center gap-1.5">
          <span>★</span>
          <span>Saved for this profile</span>
          <span className="text-gray-500 font-normal">· {filtered.length} of {cached.length}</span>
        </div>
        <button
          type="button"
          onClick={onClearAll}
          className="text-gray-500 hover:text-red-300 text-[11px]"
          title="Remove every saved entry for this profile"
        >
          Clear all
        </button>
      </div>
      {Array.from(bySource.entries()).map(([source, entries]) => (
        <div key={source} className="border border-amber-500/20 rounded-md overflow-hidden">
          <div className="bg-amber-500/[0.06] px-3 py-2 text-sm font-semibold text-gray-200 flex items-center justify-between">
            <span>{source}</span>
            <span className="text-xs text-gray-500">{entries.length} row{entries.length === 1 ? '' : 's'}</span>
          </div>
          <div className="divide-y divide-gray-800/70">
            {entries.map((e) => (
              <BreachRow
                key={`saved-${e.id}`}
                row={e.row}
                saved
                onToggleCache={() => onDelete(e.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SubjectBar({ subject }) {
  const display = subject.name || subject.steamId;
  return (
    <div className="px-5 py-2 border-b border-gray-800 bg-gray-900/40 flex items-center gap-2">
      {subject.avatarUrl && (
        <img
          src={subject.avatarUrl}
          alt=""
          className="w-7 h-7 rounded bg-gray-800 object-cover shrink-0"
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-gray-500">Currently inspecting</div>
        <div className="text-sm text-gray-200 truncate flex items-center gap-1.5">
          <Link to={`/profile/${subject.steamId}`} className="hover:text-sky-300 truncate">{display}</Link>
          {subject.realName && subject.realName !== display && (
            <span className="text-xs text-gray-500 truncate">· {subject.realName}</span>
          )}
        </div>
        <div className="text-[11px] text-gray-500 font-mono truncate">{subject.steamId}</div>
      </div>
    </div>
  );
}

function BreachResults({ results, query, loading, progress, filter, canCache, cachedByKey, onToggleCache }) {
  if (loading) return <div className="p-5 text-sm text-gray-400">Searching…</div>;
  if (results == null) {
    return (
      <div className="p-5 text-xs text-gray-500 leading-relaxed">
        Search records from public data breaches. Returns up to 10,000 results per query.
        Wildcards: <code>*</code> matches any chars, <code>?</code> matches one.
      </div>
    );
  }
  const queries = query?.queries || [];
  const queryLabel = queries.length
    ? queries.map((q) => `${(q.fields || []).join('+') || '?'}=${q.term}`).join('  ·  ')
    : '';
  if (results.length === 0) {
    return (
      <div className="p-5 text-sm text-gray-400">
        No records found{queryLabel ? <> for <span className="text-gray-200">{queryLabel}</span></> : null}.
      </div>
    );
  }

  const needle = (filter || '').trim().toLowerCase();
  const filtered = needle
    ? results.filter((r) => Object.values(r).some((v) => {
        if (v == null) return false;
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return s.toLowerCase().includes(needle);
      }))
    : results;

  if (filtered.length === 0) {
    return (
      <div className="p-5 text-sm text-gray-400">
        No matches for <span className="text-gray-200">{filter}</span> in {results.length} record{results.length === 1 ? '' : 's'}.
      </div>
    );
  }

  // Group by source for readability
  const bySource = new Map();
  for (const r of filtered) {
    const key = r.source || 'unknown';
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(r);
  }

  return (
    <div className="p-5 space-y-4">
      <div className="text-xs text-gray-400 space-y-0.5">
        <div>
          {needle
            ? <>Showing {filtered.length} of {results.length} record{results.length === 1 ? '' : 's'}</>
            : <>{results.length} record{results.length === 1 ? '' : 's'} across {bySource.size} source{bySource.size === 1 ? '' : 's'}</>
          }
          {queries.length > 1 ? <span className="text-gray-500"> · {queries.length} queries merged</span> : null}
          {progress && progress.total > 0 && progress.done < progress.total ? (
            <span className="text-amber-300/80"> · still searching {progress.done}/{progress.total}…</span>
          ) : null}
        </div>
        {queryLabel && <div className="text-gray-500 truncate" title={queryLabel}>{queryLabel}</div>}
      </div>
      {Array.from(bySource.entries()).map(([source, rows]) => (
        <div key={source} className="border border-gray-800 rounded-md overflow-hidden">
          <div className="bg-gray-900/60 px-3 py-2 text-sm font-semibold text-gray-200 flex items-center justify-between">
            <span>{source}</span>
            <span className="text-xs text-gray-500">{rows.length} row{rows.length === 1 ? '' : 's'}</span>
          </div>
          <div className="divide-y divide-gray-800/70">
            {rows.map((row, i) => {
              const key = canCache ? stableJson(row) : null;
              const saved = key ? cachedByKey?.has(key) : false;
              return (
                <BreachRow
                  key={`${source}-${i}`}
                  row={row}
                  saved={saved}
                  canCache={canCache}
                  onToggleCache={canCache ? () => onToggleCache(row, source) : null}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function BreachRow({ row, saved, canCache, onToggleCache }) {
  const entries = Object.entries(row).filter(([k]) => k !== 'source' && k !== 'categories');
  const categories = Array.isArray(row.categories) ? row.categories : row.categories ? [row.categories] : [];
  const showStar = saved || canCache || !!onToggleCache;

  return (
    <div className="px-3 py-2 text-xs relative group">
      {showStar && (
        <button
          type="button"
          onClick={onToggleCache}
          disabled={!onToggleCache}
          title={saved
            ? 'Remove from saved (cached for this profile)'
            : 'Save to this profile so you can see it without re-querying'}
          className={`absolute top-1.5 right-1.5 w-6 h-6 rounded flex items-center justify-center text-base transition-colors ring-1 ${
            saved
              ? 'text-amber-300 ring-amber-400/40 bg-amber-500/10 hover:text-amber-200 hover:bg-amber-500/20'
              : 'text-amber-300/70 ring-amber-400/30 bg-gray-900/60 hover:text-amber-200 hover:ring-amber-400/60 hover:bg-amber-500/10'
          } ${onToggleCache ? 'cursor-pointer' : 'cursor-default'}`}
        >
          {saved ? '★' : '☆'}
        </button>
      )}
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
  const copy = () => {
    if (display) navigator.clipboard.writeText(display).catch(() => {});
  };
  return (
    <>
      <div className="text-gray-500 truncate">{k}</div>
      <div className="text-gray-200 break-all cursor-pointer hover:text-sky-300" onClick={copy} title="Click to copy">
        {display || <span className="text-gray-600">—</span>}
      </div>
    </>
  );
}
