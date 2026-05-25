import { useState } from 'react';

const FIELDS = [
  { key: 'country', label: 'Country (ISO)', type: 'text', placeholder: 'e.g. US' },
  { key: 'personaState', label: 'Persona state (0-6)', type: 'number' },
  { key: 'visibilityState', label: 'Visibility (1-3)', type: 'number' },
  { key: 'minFriends', label: 'Min friends', type: 'number' },
  { key: 'maxFriends', label: 'Max friends', type: 'number' },
];

const FLAGS = [
  { key: 'vacBanned', label: 'VAC banned' },
  { key: 'gameBanned', label: 'Game banned' },
  { key: 'tradeBanned', label: 'Trade banned' },
  { key: 'hasCyrillic', label: 'Cyrillic name' },
];

export default function FilterPanel({ filters, onChange }) {
  const [open, setOpen] = useState(false);
  const update = (key, value) => onChange({ ...filters, [key]: value === '' ? undefined : value });

  return (
    <div className="card">
      <button onClick={() => setOpen((s) => !s)} className="w-full flex items-center justify-between text-sm font-medium">
        <span>Filters</span>
        <span className="text-gray-500">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="text-xs text-gray-400 flex flex-col gap-1">
              <span>{f.label}</span>
              <input
                type={f.type}
                placeholder={f.placeholder || ''}
                value={filters[f.key] ?? ''}
                onChange={(e) => update(f.key, e.target.value)}
                className="input"
              />
            </label>
          ))}
          {FLAGS.map((f) => (
            <label key={f.key} className="text-xs text-gray-400 flex flex-col gap-1">
              <span>{f.label}</span>
              <select
                value={filters[f.key] ?? ''}
                onChange={(e) => update(f.key, e.target.value)}
                className="input"
              >
                <option value="">Any</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
