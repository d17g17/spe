import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatRelative, formatDate } from '../../utils/format.js';
import Flag from '../../components/Flag.jsx';
import { useDeleteProfile, useFetchProfile } from './useProfiles.js';
import { useFetchCS2 } from '../cs2/useCS2Inventory.js';
import { useNotifications } from '../../state/NotificationContext.jsx';
import InventoryBadge from '../cs2/InventoryBadge.jsx';
import RareBadge from '../cs2/RareBadge.jsx';
import BadgesRow from '../cs2/BadgesRow.jsx';
import { LevelBadge, YearsBadge } from './SteamBadges.jsx';
import { useState } from 'react';
import ConfirmationDialog from '../../components/ConfirmationDialog.jsx';
import useLocation from '../../utils/useLocation.js';

const PERSONA_COLORS = {
  0: 'bg-gray-700',
  1: 'bg-emerald-600',
  2: 'bg-red-600',
  3: 'bg-amber-600',
  4: 'bg-amber-600',
  5: 'bg-sky-600',
  6: 'bg-sky-600',
};

const gcUrl = (profile) => {
  if (profile?.profileUrl) {
    return profile.profileUrl.replace(/^https?:\/\/steamcommunity\.com/i, 'https://gcsteamcommunity.com');
  }
  return `https://gcsteamcommunity.com/profiles/${profile.steamId}`;
};

const steamUrl = (profile) => profile?.profileUrl || `https://steamcommunity.com/profiles/${profile.steamId}`;

export default function ProfileCard({ profile, compact = false }) {
  const { mutate: deleteOne } = useDeleteProfile();
  const fetchProfile = useFetchProfile();
  const fetchCs2 = useFetchCS2();
  const { success, error } = useNotifications();
  const [confirm, setConfirm] = useState(false);
  const ps = profile.personaState ?? 0;
  const dot = PERSONA_COLORS[ps] || PERSONA_COLORS[0];
  const isPublic = profile.communityVisibilityState === 3;
  const medals = Array.isArray(profile.cs2Inventory?.medals) ? profile.cs2Inventory.medals : [];
  const refreshing = fetchProfile.isPending || fetchCs2.isPending;
  const loc = useLocation(profile);
  const cityLabel = loc?.city || loc?.state || null;

  const onRefresh = (e) => {
    e.preventDefault();
    e.stopPropagation();
    fetchProfile.mutate({ id: profile.steamId, force: true }, {
      onSuccess: () => success(`${profile.name || profile.steamId} refreshed`),
      onError: (err) => error(err?.response?.data?.error || err.message),
    });
    fetchCs2.mutate(profile.steamId, {
      onError: (err) => error(err?.response?.data?.error || err.message),
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card hover:border-gray-700 transition-colors">
      <div className="flex items-start gap-3">
        <Link to={`/profile/${profile.steamId}`} className="shrink-0 relative">
          <img
            src={profile.avatarUrl || ''}
            alt=""
            className="w-14 h-14 rounded-md bg-gray-800 object-cover"
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
          />
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 ${dot}`} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/profile/${profile.steamId}`} className="font-medium text-gray-100 truncate hover:text-sky-300 flex items-center gap-1.5">
            {profile.country && <Flag code={profile.country} size={20} />}
            <span className="truncate">{profile.name || profile.steamId}</span>
            {profile.steamLevel != null && <LevelBadge level={profile.steamLevel} />}
            {profile.timeCreated && <YearsBadge timeCreated={profile.timeCreated} />}
          </Link>
          {(profile.realName || cityLabel) && (
            <div className="text-xs truncate">
              {profile.realName && (
                <span className="text-gray-400" title={profile.realName}>{profile.realName}</span>
              )}
              {profile.realName && cityLabel && (
                <span className="text-gray-600 mx-1.5">·</span>
              )}
              {cityLabel && (
                <span
                  className="text-gray-400"
                  title={[loc?.city, loc?.state, loc?.country].filter(Boolean).join(', ')}
                >
                  {cityLabel}
                </span>
              )}
            </div>
          )}
          {!compact && (
            <>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-gray-400">
                <span><span className="text-gray-500">Friends:</span> {profile.friendsCount ?? 0}</span>
                <span><span className="text-gray-500">Updated:</span> {formatRelative(profile.updatedAt)}</span>
                <span className="col-span-2 flex items-center gap-2 flex-wrap">
                  <span>
                    <span className="text-gray-500">Last badge:</span> {formatDate(profile.lastBadgeDate)}
                  </span>
                  {medals.length > 0 && <BadgesRow badges={medals} max={3} inline />}
                </span>
              </div>
            </>
          )}
          {compact && (
            <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-gray-400">
              <span><span className="text-gray-500">Badge:</span> {formatDate(profile.lastBadgeDate)}</span>
              {medals.length > 0 && <BadgesRow badges={medals} max={3} inline />}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className={`badge ${isPublic ? 'bg-emerald-700/30 text-emerald-200' : 'bg-gray-700/40 text-gray-300'}`}>
              {isPublic ? 'Public' : 'Private'}
            </span>
            <span className={`badge ${profile.vacBanned ? 'bg-red-700/40 text-red-200' : 'bg-gray-700/30 text-gray-400'}`}>
              {profile.vacBanned ? 'VAC' : 'No VAC'}
            </span>
            {profile.gameBanned && <span className="badge bg-red-700/40 text-red-200">Game ban</span>}
            {profile.tradeBanned && <span className="badge bg-amber-700/40 text-amber-200">Trade ban</span>}
            {profile.hasCyrillic && <span className="badge bg-sky-700/40 text-sky-200">Cyrillic</span>}
            <InventoryBadge inventory={profile.cs2Inventory} />
            <RareBadge inventory={profile.cs2Inventory} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh profile + inventory"
            className="text-gray-500 hover:text-sky-300 text-sm disabled:opacity-50"
          >
            {refreshing ? '…' : '↻'}
          </button>
          <a
            href={steamUrl(profile)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Open on Steam"
            className="text-[10px] font-bold text-sky-400 hover:text-sky-300 leading-none"
          >
            ST
          </a>
          <a
            href={gcUrl(profile)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Open on GamersClub"
            className="text-[10px] font-bold text-amber-400 hover:text-amber-300 leading-none"
          >
            GC
          </a>
          {!compact && (
            <button onClick={() => setConfirm(true)} title="Delete" className="text-gray-500 hover:text-red-400 text-sm">✕</button>
          )}
        </div>
      </div>
      {confirm && (
        <ConfirmationDialog
          title="Delete profile?"
          message={`Remove ${profile.name || profile.steamId} from your library.`}
          onConfirm={() => {
            deleteOne(profile.steamId, {
              onSuccess: () => { success('Profile deleted'); setConfirm(false); },
              onError: (e) => { error(e.message); setConfirm(false); },
            });
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </motion.div>
  );
}

