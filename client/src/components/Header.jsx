import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useNotifications } from '../state/NotificationContext.jsx';
import { useDeleteAllProfiles } from '../features/profiles/useProfiles.js';
import InventoryStatsIndicator from '../features/cs2/InventoryStatsIndicator.jsx';
import ConfirmationDialog from './ConfirmationDialog.jsx';

export default function Header() {
  const location = useLocation();
  const onHome = location.pathname === '/';
  const { success, error } = useNotifications();
  const { mutate: deleteAll, isPending } = useDeleteAllProfiles();
  const [confirm, setConfirm] = useState(false);

  return (
    <header className="h-14 px-6 flex items-center justify-between border-b border-gray-800 bg-gray-900/60 backdrop-blur sticky top-0 z-10">
      <Link to="/" className="text-lg font-semibold tracking-tight">Steam Profile Explorer</Link>
      <div className="flex items-center gap-3">
        <InventoryStatsIndicator />
        {onHome && (
          <button
            onClick={() => setConfirm(true)}
            disabled={isPending}
            className="btn-danger text-sm"
          >
            Delete all profiles
          </button>
        )}
      </div>
      {confirm && (
        <ConfirmationDialog
          title="Delete all profiles?"
          message="This permanently removes every stored profile and their cached friends/inventories."
          onConfirm={() => {
            deleteAll(undefined, {
              onSuccess: (data) => { success(`Deleted ${data?.deleted ?? 0} profiles`); setConfirm(false); },
              onError: (e) => { error(e.message); setConfirm(false); },
            });
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </header>
  );
}
