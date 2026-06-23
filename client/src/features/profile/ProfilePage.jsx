import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useProfile, useFetchProfile, useDeleteProfile } from '../profiles/useProfiles.js';
import ProfileHeader from './ProfileHeader.jsx';
import FriendsList from '../friends/FriendsList.jsx';
import SavedBreachPanel from '../breach/SavedBreachPanel.jsx';
import useProfileSocket from './useProfileSocket.js';
import { useNotifications } from '../../state/NotificationContext.jsx';
import { useSettings } from '../../state/SettingsContext.jsx';
import ConfirmationDialog from '../../components/ConfirmationDialog.jsx';
import { useFetchFriends } from '../friends/useFetchFriends.js';
import { useFetchCS2 } from '../cs2/useCS2Inventory.js';

export default function ProfilePage() {
  const { steamId } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { success, error } = useNotifications();
  const [confirm, setConfirm] = useState(false);

  const profileQuery = useProfile(steamId);
  const fetchMut = useFetchProfile();
  const fetchCs2Mut = useFetchCS2();
  const deleteMut = useDeleteProfile();
  const fetchFriendsMut = useFetchFriends();
  const socketStatus = useProfileSocket(steamId);

  useEffect(() => {
    if (profileQuery.isError && profileQuery.error?.response?.status === 404) {
      fetchMut.mutate({ id: steamId, force: false }, {
        onError: (e) => error(e?.response?.data?.error || e.message),
      });
    }
  }, [profileQuery.isError, profileQuery.error?.response?.status, steamId]);

  useEffect(() => {
    if (settings.autoFetchFriends && profileQuery.data && !settings.useCachedFriends) {
      fetchFriendsMut.mutate(steamId);
    }
  }, [settings.autoFetchFriends, profileQuery.data?.steamId]);

  const profile = profileQuery.data;
  const refreshing = fetchMut.isPending || fetchCs2Mut.isPending;

  if (profileQuery.isLoading && !profile) {
    return <div className="text-gray-500 text-sm py-12 text-center">Loading profile…</div>;
  }

  if (!profile) {
    return (
      <div className="card text-sm text-red-200 max-w-xl mx-auto">
        Could not load profile <code className="text-xs">{steamId}</code>.
      </div>
    );
  }

  const onRefresh = () => {
    fetchMut.mutate({ id: steamId, force: true }, {
      onSuccess: () => success('Profile refreshed'),
      onError: (e) => error(e?.response?.data?.error || e.message),
    });
    fetchCs2Mut.mutate(steamId, {
      onError: (e) => error(e?.response?.data?.error || e.message),
    });
  };

  const onDelete = () => setConfirm(true);
  const doDelete = () => {
    deleteMut.mutate(steamId, {
      onSuccess: () => { success('Profile deleted'); navigate('/'); },
      onError: (e) => { error(e.message); setConfirm(false); },
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-7xl mx-auto">
      <ProfileHeader profile={profile} onRefresh={onRefresh} onDelete={onDelete} refreshing={refreshing} />
      <SavedBreachPanel profile={profile} />
      <FriendsList steamId={steamId} fetchStatus={socketStatus} />
      {confirm && (
        <ConfirmationDialog
          title="Delete profile?"
          message={`Remove ${profile.name || steamId} from your library.`}
          onConfirm={doDelete}
          onCancel={() => setConfirm(false)}
        />
      )}
    </motion.div>
  );
}
