import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchProfile } from './useProfiles.js';
import { useNotifications } from '../../state/NotificationContext.jsx';

export default function ProfileFetchForm() {
  const [input, setInput] = useState('');
  const { mutate, isPending } = useFetchProfile();
  const { success, error } = useNotifications();
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    mutate({ id: trimmed, force: false }, {
      onSuccess: (data) => {
        const id = data?.profile?.steamId;
        if (id) {
          success(data.fromCache ? 'Loaded from cache' : 'Fetched from Steam');
          navigate(`/profile/${id}`);
          setInput('');
        }
      },
      onError: (e) => error(e?.response?.data?.error || e.message || 'Fetch failed'),
    });
  };

  return (
    <form onSubmit={submit} className="card flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="SteamID, profile URL, or vanity name"
        className="input flex-1"
        disabled={isPending}
      />
      <button type="submit" disabled={isPending || !input.trim()} className="btn-primary text-sm whitespace-nowrap">
        {isPending ? 'Fetching…' : 'Fetch profile'}
      </button>
    </form>
  );
}
