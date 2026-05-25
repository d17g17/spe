import { useSettings } from '../state/SettingsContext.jsx';

export default function SettingsPanel({ onClose }) {
  const { settings, update } = useSettings();
  return (
    <div className="h-full flex flex-col">
      <div className="h-14 px-5 flex items-center justify-between border-b border-gray-800">
        <h2 className="text-base font-semibold">Settings</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
      </div>
      <div className="p-5 space-y-4">
        <Toggle
          label="Auto-fetch friends when opening a profile"
          checked={settings.autoFetchFriends}
          onChange={(v) => update({ autoFetchFriends: v })}
        />
        <Toggle
          label="Always use cached friends (skip background fetch)"
          checked={settings.useCachedFriends}
          onChange={(v) => update({ useCachedFriends: v })}
        />
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-3 cursor-pointer">
      <span className="text-sm text-gray-200 leading-snug">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 accent-sky-500 w-4 h-4"
      />
    </label>
  );
}
