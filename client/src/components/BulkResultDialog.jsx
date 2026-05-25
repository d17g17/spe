import { useState } from 'react';

export default function BulkResultDialog({ title, summary, errors = [], onClose }) {
  const [filter, setFilter] = useState('');
  const list = errors.filter((e) => {
    if (!filter) return true;
    const t = filter.toLowerCase();
    return (
      (e.id || '').toLowerCase().includes(t) ||
      (e.error || '').toLowerCase().includes(t) ||
      (e.stage || '').toLowerCase().includes(t)
    );
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg max-w-3xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{title}</h3>
            {summary && <div className="text-xs text-gray-400 mt-0.5">{summary}</div>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-lg leading-none">✕</button>
        </header>

        {errors.length > 0 ? (
          <>
            <div className="px-5 py-2 border-b border-gray-800">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter errors…"
                className="input w-full text-sm"
              />
              <div className="text-xs text-gray-500 mt-1">
                Showing {list.length} of {errors.length} error(s)
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1 text-xs">
              {list.map((e, i) => (
                <div key={i} className="flex gap-2 items-start py-1 border-b border-gray-800/50">
                  <code className="text-gray-400 shrink-0">{e.id}</code>
                  {e.stage && <span className="badge text-[10px] bg-gray-700/40 text-gray-300 shrink-0">{e.stage}</span>}
                  <span className="text-red-300 break-words">{e.error}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="px-5 py-6 text-center text-emerald-300 text-sm">
            All items completed without errors.
          </div>
        )}

        <footer className="px-5 py-3 border-t border-gray-800 flex justify-end">
          <button onClick={onClose} className="btn-primary text-sm">OK</button>
        </footer>
      </div>
    </div>
  );
}
