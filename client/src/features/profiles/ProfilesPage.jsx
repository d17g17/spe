import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import ProfileFetchForm from './ProfileFetchForm.jsx';
import SearchBar from './SearchBar.jsx';
import FilterPanel from './FilterPanel.jsx';
import Pagination from './Pagination.jsx';
import ProfileCard from './ProfileCard.jsx';
import { useProfilesList } from './useProfiles.js';

const PAGE_SIZE = 60;

const SORTS = [
  { value: 'updatedAt:DESC', label: 'Recently updated' },
  { value: 'createdAt:DESC', label: 'Recently added' },
  { value: 'name:ASC', label: 'Name (A→Z)' },
  { value: 'friendsCount:DESC', label: 'Most friends' },
  { value: 'playtime2Weeks:DESC', label: 'Most 2-week playtime' },
  { value: 'lastLogoff:DESC', label: 'Most recently online' },
];

export default function ProfilesPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState('updatedAt:DESC');
  const [filters, setFilters] = useState({});

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [debounced, sort, filters]);

  const [sortBy, sortDir] = sort.split(':');
  const params = useMemo(() => ({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    sortBy,
    sortDir,
    search: debounced || undefined,
    ...filters,
  }), [page, sortBy, sortDir, debounced, filters]);

  const { data, isLoading, isFetching, isError, error } = useProfilesList(params);
  const rows = data?.rows || [];
  const total = data?.total || 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-7xl mx-auto">
      <ProfileFetchForm />

      <div className="flex flex-col md:flex-row gap-3 items-stretch">
        <div className="flex-1 min-w-0">
          <SearchBar value={search} onChange={setSearch} />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="input md:w-64">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <FilterPanel filters={filters} onChange={setFilters} />

      <div className="text-xs text-gray-500 px-1 flex items-center gap-3">
        <span>{total.toLocaleString()} profile(s)</span>
        {isFetching && <span className="text-sky-400">refreshing…</span>}
      </div>

      {isError && (
        <div className="card border-red-700/50 text-red-200 text-sm">Failed: {error?.message}</div>
      )}

      {isLoading ? (
        <div className="text-gray-500 text-sm py-12 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card text-gray-400 text-sm text-center py-12">
          No profiles yet. Use the form above to add one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((p) => <ProfileCard key={p.steamId} profile={p} />)}
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
    </motion.div>
  );
}
