import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchProfile } from './useProfiles.js';
import { useNotifications } from '../../state/NotificationContext.jsx';

export default function ProfileFetchForm() {
  const [input, setInput] = useState('');
  const fetchProfile = useFetchProfile();
  const { success, error } = useNotifications();
  const navigate = useNavigate();
  const busy = fetchProfile.isPending;

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    try {
      const data = await fetchProfile.mutateAsync({
        id: trimmed,
        force: true,
        inventory: true,
      });
      const id = data?.profile?.steamId;
      if (!id) return;
      if (data.inventoryError) {
        success('Profile refreshed');
        error(data.inventoryError);
      } else {
        success('Profile and inventory refreshed');
      }
      navigate(`/profile/${id}`);
      setInput('');
    } catch (err) {
      error(err?.response?.data?.error || err.message || 'Fetch failed');
    }
  };

  return (
    <form onSubmit={submit} className="card flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="SteamID, profile URL, or vanity name"
        className="input flex-1"
        disabled={busy}
      />
      <button type="submit" disabled={busy || !input.trim()} className="btn-primary text-sm whitespace-nowrap">
        {busy ? 'Fetching…' : 'Fetch profile'}
      </button>
    </form>
  );
}
