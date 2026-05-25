import { useState, useMemo } from 'react';
import { useFriends } from './useFriends.js';
import { useFetchFriends } from './useFetchFriends.js';
import ProfileCard from '../profiles/ProfileCard.jsx';
import SearchBar from '../profiles/SearchBar.jsx';
import FriendStatistics from './FriendStatistics.jsx';
import { useNotifications } from '../../state/NotificationContext.jsx';

const SORTS = [
  { value: 'friendSince:DESC', label: 'Friends since (newest)' },
  { value: 'friendSince:ASC', label: 'Friends since (oldest)' },
  { value: 'name:ASC', label: 'Name (A→Z)' },
  { value: 'friendsCount:DESC', label: 'Most friends' },
];

export default function FriendsList({ steamId, fetchStatus }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('friendSince:DESC');
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

  const onFetch = () => {
    fetchMut.mutate(steamId, {
      onSuccess: () => success('Friend fetch started'),
      onError: (e) => error(e?.response?.data?.error || e.message),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Friends ({total})</h2>
        <button onClick={onFetch} disabled={inProgress || fetchMut.isPending} className="btn-secondary text-sm">
          {inProgress ? `Fetching… ${progressPct != null ? `${progressPct}%` : ''}` : 'Fetch friends'}
        </button>
      </div>

      {inProgress && fetchStatus.total > 0 && (
        <div className="h-1 bg-gray-800 rounded overflow-hidden">
          <div className="h-full bg-sky-500 transition-all" style={{ width: `${progressPct || 0}%` }} />
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
    </div>
  );
}
