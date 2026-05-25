import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { formatRelative, personaLabel, visibilityLabel, formatMinutes } from '../../utils/format.js';
import { lookupLocation, formatLocation } from '../../lib/locations.js';
import CS2InventoryCard from '../cs2/CS2InventoryCard.jsx';

export default function ProfileHeader({ profile, onRefresh, onDelete, refreshing }) {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    let alive = true;
    lookupLocation({
      country: profile.country,
      locStateCode: profile.locStateCode,
      locCityId: profile.locCityId,
    }).then((loc) => { if (alive) setLocation(loc); });
    return () => { alive = false; };
  }, [profile.country, profile.locStateCode, profile.locCityId]);

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-start gap-5">
        <img src={profile.avatarUrl || ''} alt="" className="w-24 h-24 rounded-md bg-gray-800 object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{profile.name || profile.steamId}</h1>
              {profile.realName && <div className="text-sm text-gray-400">{profile.realName}</div>}
              <div className="text-xs text-gray-500 mt-1">{profile.steamId}</div>
            </div>
            <div className="flex gap-2">
              {profile.profileUrl && (
                <a href={profile.profileUrl} target="_blank" rel="noreferrer" className="btn-ghost text-sm">Steam ↗</a>
              )}
              <button onClick={onRefresh} disabled={refreshing} className="btn-secondary text-sm">
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
              <button onClick={onDelete} className="btn-danger text-sm">Delete</button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Status" value={personaLabel(profile.personaState)} />
            <Stat label="Visibility" value={visibilityLabel(profile.communityVisibilityState)} />
            <Stat label="Friends" value={profile.friendsCount ?? 0} />
            <Stat label="2-week playtime" value={formatMinutes(profile.playtime2Weeks)} />
            <Stat label="Last seen" value={formatRelative(profile.lastLogoff)} />
            <Stat label="Last updated" value={formatRelative(profile.updatedAt)} />
            <Stat label="Location" value={formatLocation(location) || profile.country || '—'} />
            <Stat label="Last game" value={profile.lastPlayedGame || '—'} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {profile.vacBanned && <span className="badge bg-red-700/40 text-red-200">VAC banned</span>}
            {profile.gameBanned && <span className="badge bg-red-700/40 text-red-200">Game ban</span>}
            {profile.tradeBanned && <span className="badge bg-amber-700/40 text-amber-200">Trade banned</span>}
            {profile.hasCyrillic && <span className="badge bg-sky-700/40 text-sky-200">Cyrillic name</span>}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <CS2InventoryCard steamId={profile.steamId} />
      </div>
    </motion.div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-gray-200 truncate">{value}</div>
    </div>
  );
}
