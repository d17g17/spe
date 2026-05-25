export default function SearchBar({ value, onChange, placeholder = 'Search SteamID, name…' }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input w-full"
    />
  );
}
