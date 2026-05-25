import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatRelative, personaLabel } from '../../utils/format.js';
import { useDeleteProfile } from './useProfiles.js';
import { useNotifications } from '../../state/NotificationContext.jsx';
import InventoryBadge from '../cs2/InventoryBadge.jsx';
import { useState } from 'react';
import ConfirmationDialog from '../../components/ConfirmationDialog.jsx';

const PERSONA_COLORS = {
  0: 'bg-gray-700',
  1: 'bg-emerald-600',
  2: 'bg-red-600',
  3: 'bg-amber-600',
  4: 'bg-amber-600',
  5: 'bg-sky-600',
  6: 'bg-sky-600',
};

export default function ProfileCard({ profile, compact = false }) {
  const { mutate: deleteOne } = useDeleteProfile();
  const { success, error } = useNotifications();
  const [confirm, setConfirm] = useState(false);
  const ps = profile.personaState ?? 0;
  const dot = PERSONA_COLORS[ps] || PERSONA_COLORS[0];

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
          <Link to={`/profile/${profile.steamId}`} className="font-medium text-gray-100 truncate block hover:text-sky-300">
            {profile.name || profile.steamId}
          </Link>
          <div className="text-xs text-gray-500 truncate">{profile.steamId}</div>
          {!compact && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span>{personaLabel(ps)}</span>
              {profile.country && <span>• {profile.country}</span>}
              <span>• {profile.friendsCount ?? 0} friends</span>
              <span>• {formatRelative(profile.updatedAt)}</span>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {profile.vacBanned && <span className="badge bg-red-700/40 text-red-200">VAC</span>}
            {profile.gameBanned && <span className="badge bg-red-700/40 text-red-200">Game ban</span>}
            {profile.tradeBanned && <span className="badge bg-amber-700/40 text-amber-200">Trade ban</span>}
            {profile.hasCyrillic && <span className="badge bg-sky-700/40 text-sky-200">Cyrillic</span>}
            <InventoryBadge inventory={profile.cs2Inventory} />
          </div>
        </div>
        {!compact && (
          <button onClick={() => setConfirm(true)} title="Delete" className="text-gray-500 hover:text-red-400 text-sm">✕</button>
        )}
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
