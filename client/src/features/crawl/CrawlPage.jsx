import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import usePersistedState from '../../utils/usePersistedState.js';
import { useNotifications } from '../../state/NotificationContext.jsx';
import { useCrawlActive, useCrawlStart, useCrawlCancel } from './useCrawl.js';
import { useProfilesList } from '../profiles/useProfiles.js';
import ProfileCard from '../profiles/ProfileCard.jsx';

const STATUS_STYLES = {
  starting: 'bg-amber-700/40 text-amber-200 border-amber-500/30',
  in_progress: 'bg-sky-700/40 text-sky-200 border-sky-500/30',
  complete: 'bg-emerald-700/40 text-emerald-200 border-emerald-500/30',
  cancelled: 'bg-gray-700/40 text-gray-300 border-gray-500/30',
  error: 'bg-red-700/40 text-red-200 border-red-500/30',
};

const STATUS_LABELS = {
  starting: 'Starting…',
  in_progress: 'Crawling',
  complete: 'Complete',
  cancelled: 'Cancelled',
  error: 'Error',
};

export default function CrawlPage() {
  const { error: toastError, success } = useNotifications();
  const [formOpen, setFormOpen] = useState(true);

  const [steamId, setSteamId] = usePersistedState('crawl.steamId', '');
  const [depth, setDepth] = usePersistedState('crawl.depth', 1);
  const [maxDiscoveries, setMaxDiscoveries] = usePersistedState('crawl.maxDiscoveries', 5000);
  const [threads, setThreads] = usePersistedState('crawl.threads', 10);
  
  const [conditions, setConditions] = usePersistedState('crawl.conditions', {
    minCs2Value: 500,
    country: '',
    noVacBan: true,
    noGameBan: true,
    noTradeBan: true,
    isPublic: true,
    cyrillicName: false,
  });

  const { data: activeCrawls } = useCrawlActive();
  const crawlStart = useCrawlStart();
  const crawlCancel = useCrawlCancel();

  const crawlEntries = activeCrawls
    ? Object.entries(activeCrawls)
        .filter(([, v]) => v && v.status)
        .sort((a, b) => {
          const running = (s) => s === 'in_progress' || s === 'starting' ? 0 : 1;
          const diff = running(a[1].status) - running(b[1].status);
          if (diff !== 0) return diff;
          return (b[1].updatedAt || 0) - (a[1].updatedAt || 0);
        })
    : [];

  const hasRunning = crawlEntries.some(([, v]) => v.status === 'in_progress' || v.status === 'starting');

  // Fetch recent discoveries
  const recentParams = useMemo(() => ({
    limit: 6,
    sortBy: 'createdAt',
    sortDir: 'DESC'
  }), []);
  // Use a fast refetch interval if a crawl is actively running
  const { data: recentData } = useProfilesList(recentParams, hasRunning ? 3000 : false);
  const recentProfiles = recentData?.rows || [];

  const handleConditionChange = (key, value) => {
    setConditions((c) => ({ ...c, [key]: value }));
  };

  const toggleCondition = (key) => {
    setConditions((c) => ({ ...c, [key]: !c[key] }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!steamId.trim()) return toastError('Steam ID is required');
    crawlStart.mutate(
      { steamId: steamId.trim(), options: { depth: parseInt(depth, 10), maxDiscoveries: parseInt(maxDiscoveries, 10), threads: parseInt(threads, 10), conditions } },
      {
        onSuccess: () => success('Crawl started'),
        onError: (err) => toastError(err?.response?.data?.error || err.message),
      }
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-7xl mx-auto pb-12">
      


      {/* Crawler Config (Looks like FilterPanel) */}
      <div className="card">
        <button type="button" onClick={() => setFormOpen((s) => !s)} className="w-full flex items-center justify-between text-sm font-medium">
          <span>Crawler Configuration {hasRunning && <span className="ml-2 text-emerald-400 animate-pulse font-normal">(Active)</span>}</span>
          <span className="text-gray-500">{formOpen ? '−' : '+'}</span>
        </button>
        {formOpen && (
          <form onSubmit={onSubmit} className="mt-3">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <label className="text-xs text-gray-400 flex flex-col gap-1 col-span-2 md:col-span-1">
                <span>Root Steam ID</span>
                <input 
                  value={steamId}
                  onChange={(e) => setSteamId(e.target.value)}
                  placeholder="76561198..."
                  className="input"
                  required
                />
              </label>

              <label className="text-xs text-gray-400 flex flex-col gap-1">
                <span>Depth</span>
                <select value={depth} onChange={(e) => setDepth(e.target.value)} className="input">
                  <option value={1}>1 - Friends</option>
                  <option value={2}>2 - Extended</option>
                </select>
              </label>

              <label className="text-xs text-gray-400 flex flex-col gap-1">
                <span>Threads</span>
                <input 
                  type="number" min="1" max="100" 
                  value={threads} onChange={(e) => setThreads(e.target.value)}
                  className="input"
                />
              </label>

              <label className="text-xs text-gray-400 flex flex-col gap-1">
                <span>Target Limit</span>
                <input 
                  type="number" min="100" step="100"
                  value={maxDiscoveries} onChange={(e) => setMaxDiscoveries(e.target.value)}
                  className="input"
                />
              </label>

              <label className="text-xs text-gray-400 flex flex-col gap-1">
                <span>Min Value ($)</span>
                <input 
                  type="number" min="0" value={conditions.minCs2Value} 
                  onChange={(e) => handleConditionChange('minCs2Value', Number(e.target.value))}
                  className="input"
                />
              </label>

              <label className="text-xs text-gray-400 flex flex-col gap-1">
                <span>Country (ISO)</span>
                <input 
                  type="text" maxLength="2" placeholder="e.g. US" value={conditions.country} 
                  onChange={(e) => handleConditionChange('country', e.target.value.toUpperCase())}
                  className="input uppercase"
                />
              </label>

              {[
                ['noVacBan', 'No VAC Ban'],
                ['noGameBan', 'No Game Ban'],
                ['noTradeBan', 'No Trade Ban'],
                ['isPublic', 'Public Profile Only'],
                ['cyrillicName', 'Cyrillic Name'],
              ].map(([key, label]) => (
                <label key={key} className="text-xs text-gray-400 flex items-end gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(conditions[key])}
                    onChange={() => toggleCondition(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}

              <div className="col-span-full pt-2">
                <button 
                  type="submit" 
                  disabled={crawlStart.isPending}
                  className="btn-primary w-full md:w-auto"
                >
                  {crawlStart.isPending ? 'Starting...' : 'Start Crawler'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Active Operations List */}
      {crawlEntries.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-sm font-medium">Active Operations</h2>
          <div className="flex flex-col gap-2">
            {crawlEntries.map(([id, crawl]) => (
              <CrawlRow key={id} steamId={id} crawl={crawl} onCancel={() => {
                crawlCancel.mutate(id, {
                  onSuccess: () => success('Operation canceled'),
                  onError: (err) => toastError(err?.message || 'Failed to cancel'),
                });
              }} />
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 px-1 flex items-center gap-3">
        <span>{recentProfiles.length.toLocaleString()} recent profile(s)</span>
        {hasRunning && <span className="text-sky-400 animate-pulse">crawling network...</span>}
      </div>

      {recentProfiles.length === 0 ? (
        <div className="card border-dashed border-gray-800 bg-transparent flex flex-col items-center justify-center py-16 text-center shadow-none">
          <h3 className="text-gray-400 font-medium text-sm">No Recent Discoveries</h3>
          <p className="text-gray-600 text-xs mt-1">Start a crawl operation to discover new profiles.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {recentProfiles.map((p) => (
            <ProfileCard key={p.steamId} profile={p} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function CrawlRow({ steamId, crawl, onCancel }) {
  const isRunning = crawl.status === 'in_progress' || crawl.status === 'starting';
  const processed = crawl.processed || 0;
  const discovered = crawl.totalDiscovered || 0;
  const progress = discovered > 0 ? Math.min((processed / discovered) * 100, 100) : 0;

  return (
    <div className="border border-gray-800/50 rounded bg-gray-900/30 overflow-hidden text-sm relative">
      {isRunning && (
        <div className="w-full h-1 bg-gray-800">
          <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
        </div>
      )}
      
      <div className="p-3 flex items-center justify-between gap-4">
        <div className="flex flex-col">
           <span className="text-gray-200 font-mono" title={steamId}>{steamId}</span>
        </div>

        <div className="flex items-center gap-6 text-xs text-gray-400">
           <div><span className="text-gray-200">{discovered.toLocaleString()}</span> discovered</div>
           <div><span className="text-gray-200">{processed.toLocaleString()}</span> processed</div>
           <div><span className="text-emerald-400 font-medium">{(crawl.matches || 0).toLocaleString()}</span> matches</div>
        </div>

        <div className="flex items-center gap-4">
           <span className={`badge ${STATUS_STYLES[crawl.status] || 'bg-gray-800 text-gray-300'}`}>
              {STATUS_LABELS[crawl.status] || crawl.status}
              {isRunning && <span className="ml-1 opacity-80">{Math.floor(progress)}%</span>}
           </span>

           {isRunning && (
              <button onClick={onCancel} className="btn-ghost p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20" title="Cancel Operation">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
           )}
        </div>
      </div>
    </div>
  );
}
