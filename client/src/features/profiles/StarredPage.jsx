import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import SearchBar from './SearchBar.jsx';
import Pagination from './Pagination.jsx';
import ProfileCard from './ProfileCard.jsx';
import { useProfilesList, useStarProfile } from './useProfiles.js';
import usePersistedState from '../../utils/usePersistedState.js';
import { useNotifications } from '../../state/NotificationContext.jsx';

const PAGE_SIZE = 60;

const SORTS = [
  { value: 'smart:DESC', label: 'Smart (value × badge age)' },
  { value: 'inventoryValue:DESC', label: 'Most expensive inventory' },
  { value: 'createdAt:DESC', label: 'Recently added' },
  { value: 'name:ASC', label: 'Name (A→Z)' },
];

function parseNote(raw) {
  try {
    if (!raw) return { realName: '', email: '', phone: '', cpf: '', login: '', ticket: '', momMethod: false, momName: '', momCpf: '', momEmail: '', notes: '' };
    if (typeof raw === 'string' && raw.trim().startsWith('{')) return JSON.parse(raw);
  } catch (e) {}
  return { realName: '', email: '', phone: '', cpf: '', login: '', ticket: '', momMethod: false, momName: '', momCpf: '', momEmail: '', notes: raw || '' };
}

function formatMoney(val) {
  if (!val) return '$0.00';
  return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function StarredPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = usePersistedState('starred.sort', 'smart:DESC');
  const [viewMode, setViewMode] = usePersistedState('starred.viewMode', 'grid');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [debounced, sort]);

  const [sortBy, sortDir] = sort.split(':');
  const params = useMemo(() => ({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    sortBy,
    sortDir,
    search: debounced || undefined,
    isStarred: true,
  }), [page, sortBy, sortDir, debounced]);

  const { data, isLoading, isFetching } = useProfilesList(params);
  const rows = data?.rows || [];
  const total = data?.total || 0;

  const totalValue = rows.reduce((sum, p) => sum + (p.cs2Inventory?.totalValueUsd || 0), 0);
  
  // Dashboard Analytics
  const avgValue = rows.length > 0 ? totalValue / rows.length : 0;
  const highestValueProfile = rows.reduce((max, p) => {
    const val = p.cs2Inventory?.totalValueUsd || 0;
    const maxVal = max?.cs2Inventory?.totalValueUsd || 0;
    return val > maxVal ? p : max;
  }, rows[0] || null);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 max-w-7xl mx-auto">
      {/* Header & Dashboard */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-bold text-gray-100 tracking-tight">Watchlist</h1>
            <span className="text-gray-500 text-sm font-medium">{total.toLocaleString()} profiles tracked</span>
          </div>
          
          {/* Inline Dashboard Analytics */}
          {rows.length > 0 && (
            <div className="flex items-center gap-4 mt-3 text-sm font-medium bg-gray-900/30 border border-gray-800/50 rounded-md px-3 py-1.5 w-max">
              <div>
                <span className="text-gray-500 mr-1.5">Page Value:</span>
                <span className="text-emerald-400">{formatMoney(totalValue)}</span>
              </div>
              <div className="w-px h-3 bg-gray-700"></div>
              <div>
                <span className="text-gray-500 mr-1.5">Avg:</span>
                <span className="text-gray-200">{formatMoney(avgValue)}</span>
              </div>
              <div className="w-px h-3 bg-gray-700"></div>
              <div className="flex items-center">
                <span className="text-gray-500 mr-1.5">Top Target:</span>
                <span className="text-gray-200 truncate max-w-[100px]">{highestValueProfile?.personaname || 'N/A'}</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1 bg-gray-900/40 p-1 rounded-md border border-gray-800/60 h-max">
          <button 
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded text-[13px] font-bold tracking-wide transition-colors ${viewMode === 'grid' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
          >
            GRID
          </button>
          <button 
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded text-[13px] font-bold tracking-wide transition-colors ${viewMode === 'table' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
          >
            TABLE
          </button>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch">
        <div className="flex-1 min-w-0">
          <SearchBar value={search} onChange={setSearch} />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="input md:w-64">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Count + loading */}
      {isFetching && (
        <div className="text-xs px-1 text-amber-400 animate-pulse font-medium">
          Refreshing data...
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="text-gray-500 text-sm py-12 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card border-dashed border-gray-800 bg-transparent flex flex-col items-center justify-center py-16 text-center shadow-none">
          <h3 className="text-gray-400 font-medium text-sm">No Watchlist Profiles</h3>
          <p className="text-gray-600 text-xs mt-1">Star profiles from the main page to see them here.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((p) => (
            <StarredCardWrapper key={p.steamId} profile={p} />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-900/80 text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Profile</th>
                  <th className="px-4 py-3 font-medium">Inventory</th>
                  <th className="px-4 py-3 font-medium">Bans</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {rows.map((p) => (
                  <StarredTableRow key={p.steamId} profile={p} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
    </motion.div>
  );
}

function StarredCardWrapper({ profile }) {
  const [editing, setEditing] = useState(false);
  const parsed = useMemo(() => parseNote(profile.starNote), [profile.starNote]);
  const [formData, setFormData] = useState(parsed);
  const { mutate: setStar } = useStarProfile();
  const { success } = useNotifications();

  useEffect(() => {
    if (!editing) setFormData(parseNote(profile.starNote));
  }, [profile.starNote, editing]);

  const onChange = (e) => setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const onSaveNote = (e) => {
    e.preventDefault();
    setStar({ id: profile.steamId, isStarred: true, starNote: JSON.stringify(formData) }, {
      onSuccess: () => {
        setEditing(false);
        success('Intelligence updated');
      },
    });
  };

  const hasData = formData.realName || formData.email || formData.phone || formData.cpf || formData.login || formData.ticket || formData.momMethod || formData.momName || formData.momCpf || formData.momEmail || formData.notes;

  const renderTicketLink = (tkt) => {
    if (!tkt) return null;
    const url = tkt.startsWith('http') ? tkt : `https://help.steampowered.com/pt-br/wizard/HelpRequest/${tkt}`;
    return (
      <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-sky-400 hover:text-sky-300 transition-colors">
        {tkt}
      </a>
    );
  };

  return (
    <div>
      <ProfileCard profile={profile} />
      <div className="-mt-1 bg-gray-900/60 border border-t-0 border-gray-800 rounded-b-lg p-4">
        {editing ? (
          <form onSubmit={onSaveNote} className="space-y-2.5 pt-0.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-950 border border-gray-800 rounded px-2 py-1 focus-within:border-gray-600 transition-colors col-span-2">
                <div className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Real Name</div>
                <input name="realName" value={formData.realName || ''} onChange={onChange} className="bg-transparent outline-none w-full text-xs text-gray-200 mt-px" placeholder="Full Name" />
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded px-2 py-1 focus-within:border-gray-600 transition-colors col-span-2">
                <div className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Email</div>
                <input name="email" value={formData.email || ''} onChange={onChange} className="bg-transparent outline-none w-full text-xs text-gray-200 mt-px" placeholder="email@example.com" />
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded px-2 py-1 focus-within:border-gray-600 transition-colors">
                <div className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Phone</div>
                <input name="phone" value={formData.phone || ''} onChange={onChange} className="bg-transparent outline-none w-full text-xs text-gray-200 mt-px" placeholder="Ex: 555-1234" />
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded px-2 py-1 focus-within:border-gray-600 transition-colors">
                <div className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">CPF</div>
                <input name="cpf" value={formData.cpf || ''} onChange={onChange} className="bg-transparent outline-none w-full text-xs text-gray-200 mt-px" placeholder="000.000.000-00" />
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded px-2 py-1 focus-within:border-gray-600 transition-colors">
                <div className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Login</div>
                <input name="login" value={formData.login || ''} onChange={onChange} className="bg-transparent outline-none w-full text-xs text-gray-200 mt-px" placeholder="Username" />
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded px-2 py-1 focus-within:border-gray-600 transition-colors">
                <div className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Steam Ticket</div>
                <input name="ticket" value={formData.ticket || ''} onChange={onChange} className="bg-transparent outline-none w-full text-xs text-sky-400 mt-px" placeholder="HT-XXXX-XXXX" />
              </div>
            </div>
            
            <div className="border-t border-gray-800/60 pt-2.5">
              <label className="flex items-center gap-1.5 cursor-pointer w-max mb-1.5 hover:opacity-80 transition-opacity">
                <input type="checkbox" name="momMethod" checked={formData.momMethod} onChange={(e) => setFormData(p => ({ ...p, momMethod: e.target.checked }))} className="w-3 h-3 rounded border-gray-700 bg-gray-900 accent-gray-500" />
                <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wider">Mom Method</span>
              </label>
              
              {formData.momMethod && (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="bg-gray-950 border border-gray-800 rounded px-2 py-1 focus-within:border-gray-600 transition-colors col-span-2">
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Mom's Name</div>
                    <input name="momName" value={formData.momName || ''} onChange={onChange} className="bg-transparent outline-none w-full text-xs text-gray-200 mt-px" placeholder="Full Name" />
                  </div>
                  <div className="bg-gray-950 border border-gray-800 rounded px-2 py-1 focus-within:border-gray-600 transition-colors">
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Mom's CPF</div>
                    <input name="momCpf" value={formData.momCpf || ''} onChange={onChange} className="bg-transparent outline-none w-full text-xs text-gray-200 mt-px" placeholder="000.000.000-00" />
                  </div>
                  <div className="bg-gray-950 border border-gray-800 rounded px-2 py-1 focus-within:border-gray-600 transition-colors">
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Mom's Email</div>
                    <input name="momEmail" value={formData.momEmail || ''} onChange={onChange} className="bg-transparent outline-none w-full text-xs text-gray-200 mt-px" placeholder="email@example.com" />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-950 border border-gray-800 rounded focus-within:border-gray-600 transition-colors p-1.5">
              <textarea
                name="notes"
                value={formData.notes || ''}
                onChange={onChange}
                placeholder="Additional notes..."
                className="w-full bg-transparent outline-none resize-y min-h-[48px] text-xs text-gray-200 placeholder:text-gray-600 p-0.5"
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-1 border-t border-gray-800/50">
              <button type="button" onClick={() => { setEditing(false); setFormData(parseNote(profile.starNote)); }} className="text-[10px] uppercase font-bold tracking-wider text-gray-500 hover:text-white px-2 py-1 transition-colors">Discard</button>
              <button type="submit" className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded transition-colors flex items-center gap-1">
                <span className="text-sky-400">✓</span> Save
              </button>
            </div>
          </form>
        ) : (
          <div onClick={() => setEditing(true)} className="cursor-pointer group min-h-[36px] relative rounded hover:bg-gray-900/40 transition-colors p-2 -mx-2 -my-2 border border-transparent hover:border-gray-800/50">
            {!hasData ? (
              <div className="text-[11px] text-gray-500 italic flex items-center gap-1.5 py-0.5">
                <span className="text-sky-500 text-xs leading-none opacity-80 group-hover:opacity-100">✎</span> 
                <span className="group-hover:text-gray-300 transition-colors">Click here to add intelligence notes...</span>
              </div>
            ) : (
              <div className="space-y-2 pr-12">
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs">
                  {formData.realName && <div className="col-span-2"><span className="text-gray-500 uppercase tracking-wider text-[9px] block">Real Name</span><span className="text-gray-200">{formData.realName}</span></div>}
                  {formData.email && <div className="col-span-2"><span className="text-gray-500 uppercase tracking-wider text-[9px] block">Email</span><span className="text-gray-200">{formData.email}</span></div>}
                  {formData.phone && <div><span className="text-gray-500 uppercase tracking-wider text-[9px] block">Phone</span><span className="text-gray-200">{formData.phone}</span></div>}
                  {formData.cpf && <div><span className="text-gray-500 uppercase tracking-wider text-[9px] block">CPF</span><span className="text-gray-200">{formData.cpf}</span></div>}
                  {formData.login && <div><span className="text-gray-500 uppercase tracking-wider text-[9px] block">Login</span><span className="text-gray-200">{formData.login}</span></div>}
                  {formData.ticket && <div><span className="text-gray-500 uppercase tracking-wider text-[9px] block">Ticket</span>{renderTicketLink(formData.ticket)}</div>}
                </div>
                
                {(formData.momMethod || formData.notes) && (
                  <div className="pt-1.5 border-t border-gray-800/40">
                    {formData.momMethod && (
                      <div className="mb-2">
                        <span className="inline-block bg-gray-800 text-gray-300 border border-gray-700 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider mb-1.5">
                          Mom Method
                        </span>
                        {(formData.momName || formData.momCpf || formData.momEmail) && (
                          <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs ml-1 border-l-2 border-gray-800 pl-2.5 py-0.5">
                            {formData.momName && <div className="col-span-2"><span className="text-gray-500 uppercase tracking-wider text-[9px] block">Name</span><span className="text-gray-200">{formData.momName}</span></div>}
                            {formData.momCpf && <div><span className="text-gray-500 uppercase tracking-wider text-[9px] block">CPF</span><span className="text-gray-200">{formData.momCpf}</span></div>}
                            {formData.momEmail && <div><span className="text-gray-500 uppercase tracking-wider text-[9px] block">Email</span><span className="text-gray-200">{formData.momEmail}</span></div>}
                          </div>
                        )}
                      </div>
                    )}
                    {formData.notes && (
                      <div className="text-[11px] text-gray-400 whitespace-pre-wrap break-words leading-relaxed">
                        {formData.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Explicit Edit Button always visible */}
            <div className="absolute top-1 right-1.5">
              <button className="text-gray-600 group-hover:text-sky-400 text-[9px] uppercase tracking-widest font-bold transition-colors flex items-center gap-1 pointer-events-none">
                ✎ EDIT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StarredTableRow({ profile }) {
  const { mutate: setStar } = useStarProfile();
  
  return (
    <tr className="hover:bg-gray-800/20 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={profile.avatarUrl} alt="" className="w-8 h-8 rounded-full border border-gray-700" />
          <div className="flex flex-col min-w-[120px]">
            <a href={`https://steamcommunity.com/profiles/${profile.steamId}`} target="_blank" rel="noreferrer" className="text-gray-200 font-medium hover:text-sky-400 transition-colors truncate max-w-[200px]">
              {profile.personaname}
            </a>
            <span className="text-xs text-gray-500 font-mono">{profile.steamId}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {profile.cs2Inventory ? (
          <div className="flex flex-col">
            <span className="text-emerald-400 font-medium">{formatMoney(profile.cs2Inventory.totalValueUsd)}</span>
            <span className="text-xs text-gray-500">{profile.cs2Inventory.itemCount} items</span>
          </div>
        ) : (
          <span className="text-xs text-gray-600">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5">
          {profile.vacBanned && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">VAC</span>}
          {profile.gameBanned && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400">GAME</span>}
          {profile.tradeBanned && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400">TRADE</span>}
          {!profile.vacBanned && !profile.gameBanned && !profile.tradeBanned && <span className="text-gray-600 text-xs">—</span>}
        </div>
      </td>
      <td className="px-4 py-3 max-w-[280px] truncate text-xs">
        {(() => {
          const p = parseNote(profile.starNote);
          const hasIntel = p.phone || p.cpf || p.login || p.ticket || p.momMethod || p.notes;
          if (!hasIntel) return <span className="italic text-[#5c5548] font-mono">Empty notebook</span>;
          
          return (
            <div className="flex items-center gap-1.5 overflow-hidden text-gray-400 font-mono">
              {p.momMethod && <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded-sm text-[10px] shrink-0 border border-gray-700 font-bold">MOM</span>}
              {p.realName && <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded-sm text-[10px] shrink-0 border border-gray-700">NAME</span>}
              {p.phone && <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded-sm text-[10px] shrink-0 border border-gray-700">PH</span>}
              {p.cpf && <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded-sm text-[10px] shrink-0 border border-gray-700">CPF</span>}
              {p.login && <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded-sm text-[10px] shrink-0 border border-gray-700">LOG</span>}
              {p.ticket && (
                <a 
                  href={p.ticket.startsWith('http') ? p.ticket : `https://help.steampowered.com/pt-br/wizard/HelpRequest/${p.ticket}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="bg-sky-900/40 text-sky-400 hover:text-sky-300 hover:bg-sky-800/40 px-1.5 py-0.5 rounded-sm text-[10px] shrink-0 border border-sky-700/50 cursor-pointer transition-colors"
                >
                  TKT
                </a>
              )}
              {p.notes && <span className="truncate opacity-80">{p.notes}</span>}
            </div>
          );
        })()}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => setStar({ id: profile.steamId, isStarred: false })}
          className="text-gray-500 hover:text-white transition-colors text-xs uppercase font-semibold"
          title="Unstar"
        >
          Remove
        </button>
      </td>
    </tr>
  );
}
