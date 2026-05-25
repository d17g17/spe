export default function Pagination({ page, pageSize, total, onChange }) {
  const last = Math.max(0, Math.ceil(total / pageSize) - 1);
  if (last === 0) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <button onClick={() => onChange(0)} disabled={page === 0} className="btn-ghost text-sm">«</button>
      <button onClick={() => onChange(Math.max(0, page - 1))} disabled={page === 0} className="btn-ghost text-sm">‹</button>
      <span className="text-sm text-gray-400 px-2">Page {page + 1} / {last + 1}</span>
      <button onClick={() => onChange(Math.min(last, page + 1))} disabled={page >= last} className="btn-ghost text-sm">›</button>
      <button onClick={() => onChange(last)} disabled={page >= last} className="btn-ghost text-sm">»</button>
    </div>
  );
}
