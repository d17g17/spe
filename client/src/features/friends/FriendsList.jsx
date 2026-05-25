import { useState, useMemo, useEffect, useRef } from 'react';
import { useFriends } from './useFriends.js';
import { useFetchFriends } from './useFetchFriends.js';
import ProfileCard from '../profiles/ProfileCard.jsx';
import SearchBar from '../profiles/SearchBar.jsx';
import FriendStatistics from './FriendStatistics.jsx';
import { useNotifications } from '../../state/NotificationContext.jsx';
import BulkResultDialog from '../../components/BulkResultDialog.jsx';
import {
  useBulkInventoryStatus, useStartBulkInventory, useBulkInventorySocket,
} from '../cs2/useBulkInventory.js';
import { speedPercent } from '../../utils/concurrency.js';

const SORTS = [
  { value: 'friendSince:DESC', label: 'Friends since (newest)' },
  { value: 'friendSince:ASC', label: 'Friends since (oldest)' },
  { value: 'name:ASC', label: 'Name (A→Z)' },
  { value: 'friendsCount:DESC', label: 'Most friends' },
];

export default function FriendsList({ steamId, fetchStatus }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('friendSince:DESC');
  const [bulkConcurrency, setBulkConcurrency] = useState(4);
  const [bulkAdaptive, setBulkAdaptive] = useState(false);
  const friendsQuery = useFriends(steamId, { limit: 1000 });
  const fetchMut = useFetchFriends();
  const { success, error } = useNotifications();

  const friends = friendsQuery.data?.friends || [];
  const total = friendsQuery.data?.total || 0;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let out = !term
      ? friends.slice()
      : friends.filter((f) =>
          (f.name || '').toLowerCase().includes(term) ||
          (f.steamId || '').includes(term) ||
          (f.realName || '').toLowerCase().includes(term)
        );
    const [k, dir] = sort.split(':');
    const sign = dir === 'ASC' ? 1 : -1;
    out.sort((a, b) => {
      const av = a[k] ?? (k === 'name' ? '' : 0);
      const bv = b[k] ?? (k === 'name' ? '' : 0);
      if (typeof av === 'string') return sign * av.localeCompare(bv);
      return sign * ((new Date(av).getTime() || av) - (new Date(bv).getTime() || bv));
    });
    return out;
  }, [friends, search, sort]);

  const status = fetchStatus?.status || 'idle';
  const inProgress = status === 'starting' || status === 'in_progress';
  const progressPct = status === 'in_progress' && fetchStatus.total
    ? Math.round((fetchStatus.processed / fetchStatus.total) * 100)
    : null;

  const bulkStatus = useBulkInventoryStatus(steamId);
  const startBulk = useStartBulkInventory();
  useBulkInventorySocket(steamId);
  const bulk = bulkStatus.data || {};
  const bulkInProgress = bulk.status === 'starting' || bulk.status === 'in_progress';
  const bulkPct = bulkInProgress && bulk.toFetch
    ? Math.round((bulk.processed / bulk.toFetch) * 100)
    : null;

  const [report, setReport] = useState(null);
  const prevBulkStatus = useRef(bulk.status);
  useEffect(() => {
    const prev = prevBulkStatus.current;
    const cur = bulk.status;
    if ((prev === 'starting' || prev === 'in_progress') && (cur === 'complete' || cur === 'error')) {
      setReport({
        title: cur === 'error' ? 'Bulk inventory error' : 'Bulk inventory complete',
        summary: `${bulk.checked || 0} checked · ${bulk.private || 0} private · ${bulk.empty || 0} empty · ${bulk.errors || 0} failed · ${bulk.skipped || 0} cached`,
        errors: Array.isArray(bulk.errorLog) ? bulk.errorLog : [],
      });
    }
    prevBulkStatus.current = cur;
  }, [bulk.status, bulk.checked, bulk.private, bulk.empty, bulk.errors, bulk.skipped, bulk.errorLog]);

  const onFetch = () => {
    fetchMut.mutate(steamId, {
      onSuccess: () => success('Friend fetch started'),
      onError: (e) => error(e?.response?.data?.error || e.message),
    });
  };

  const onBulk = (force = false) => {
    startBulk.mutate({ ownerId: steamId, force, concurrency: bulkConcurrency, adaptive: bulkAdaptive }, {
      onSuccess: () => success(force ? 'Bulk inventory refresh started' : 'Bulk inventory fetch started'),
      onError: (e) => error(e?.response?.data?.error || e.message),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Friends ({total})</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={onFetch} disabled={inProgress || fetchMut.isPending} className="btn-secondary text-sm">
            {inProgress ? `Fetching friends… ${progressPct != null ? `${progressPct}%` : ''}` : 'Fetch friends'}
          </button>
          <button
            onClick={() => onBulk(false)}
            disabled={bulkInProgress || startBulk.isPending || friends.length === 0}
            className="btn-primary text-sm"
            title="Fetch CS2 inventory + prices for every friend (skips recent)"
          >
            {bulkInProgress
              ? `Inventories… ${bulkPct != null ? `${bulkPct}%` : ''} (${bulk.processed || 0}/${bulk.toFetch || 0})`
              : 'Fetch friend inventories'}
          </button>
          {bulkInProgress && bulk.adaptive && (
            <span
              className="text-xs px-2 py-1 rounded border bg-emerald-700/30 border-emerald-500/60 text-emerald-200 font-semibold tabular-nums self-center"
              title={`Adaptive concurrency · ${bulk.concurrency} workers (12 = 100%, 20 = 200%)`}
            >
              ⚡ Adaptive · {speedPercent(bulk.concurrency)}% · {bulk.concurrency}
            </span>
          )}
          {!bulkInProgress && (
            <>
              <button
                type="button"
                onClick={() => setBulkAdaptive((v) => !v)}
                className={`text-xs px-2 py-1 rounded border ${bulkAdaptive
                  ? 'bg-emerald-700/30 border-emerald-500/60 text-emerald-200'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}
                title="Auto-tune concurrency. Speeds up when stable, backs off on rate limits."
              >
                {bulkAdaptive ? '⚡ Adaptive' : 'Adaptive: off'}
              </button>
              <label
                className={`text-xs text-gray-400 flex items-center gap-2 ${bulkAdaptive ? 'opacity-50' : ''}`}
                title={bulkAdaptive ? 'Disabled while Adaptive is on' : 'Number of friends to fetch in parallel (1-20)'}
              >
                <span>Concurrency</span>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={bulkConcurrency}
                  disabled={bulkAdaptive}
                  onChange={(e) => setBulkConcurrency(Number(e.target.value))}
                  className="w-28 accent-sky-500 disabled:cursor-not-allowed"
                />
                <span className="text-gray-200 tabular-nums w-5 text-center">{bulkConcurrency}</span>
              </label>
              <button
                onClick={() => onBulk(true)}
                disabled={startBulk.isPending || friends.length === 0}
                className="btn-ghost text-sm"
                title="Force refresh, ignore 24h cache"
              >
                Force refresh
              </button>
            </>
          )}
        </div>
      </div>

      {inProgress && fetchStatus.total > 0 && (
        <div className="h-1 bg-gray-800 rounded overflow-hidden">
          <div className="h-full bg-sky-500 transition-all" style={{ width: `${progressPct || 0}%` }} />
        </div>
      )}

      {bulkInProgress && (
        <div className="card text-xs text-gray-300 space-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>Processed: <span className="text-gray-100">{bulk.processed || 0}/{bulk.toFetch || 0}</span></span>
            <span>Checked: <span className="text-emerald-300">{bulk.checked || 0}</span></span>
            <span>Private: <span className="text-amber-300">{bulk.private || 0}</span></span>
            <span>Empty: <span className="text-gray-400">{bulk.empty || 0}</span></span>
            <span>Errors: <span className="text-red-300">{bulk.errors || 0}</span></span>
            <span>Skipped (cached): <span className="text-gray-400">{bulk.skipped || 0}</span></span>
          </div>
          <div className="h-1 bg-gray-800 rounded overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${bulkPct || 0}%` }} />
          </div>
        </div>
      )}

      {friends.length > 0 && <FriendStatistics friends={friends} />}

      <div className="flex gap-2">
        <SearchBar value={search} onChange={setSearch} placeholder="Search friends…" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="input md:w-64">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {friendsQuery.isLoading ? (
        <div className="text-gray-500 text-sm py-8 text-center">Loading friends…</div>
      ) : filtered.length === 0 ? (
        <div className="card text-sm text-gray-400 text-center py-8">
          {friends.length === 0 ? 'No cached friends. Click "Fetch friends" to hydrate.' : 'No matches.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((f) => <ProfileCard key={f.steamId} profile={f} compact />)}
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
