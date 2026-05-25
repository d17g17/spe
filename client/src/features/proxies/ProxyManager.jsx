import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useProxies, useSetProxy, useSetAllProxies, useReloadProxies,
  useClearProxyHealth, useSetProxiesGlobal, useTestProxies, useTestProxy,
  useImportProxies, useProxyTestStatus, useCancelTest,
} from './useProxies.js';
import { useNotifications } from '../../state/NotificationContext.jsx';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'enabled', label: 'Enabled' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'http', label: 'HTTP' },
  { id: 'socks5', label: 'SOCKS5' },
  { id: 'untested', label: 'Untested' },
];

const PROTO_LABEL = { http: 'HTTP', socks5: 'SOCKS5' };
const PROTO_STYLE = {
  http: 'bg-sky-700/30 text-sky-200',
  socks5: 'bg-violet-700/30 text-violet-200',
};

export default function ProxyManager({ onClose }) {
  const { data, isLoading, isFetching } = useProxies();
  const setOne = useSetProxy();
  const setAll = useSetAllProxies();
  const setGlobal = useSetProxiesGlobal();
  const reload = useReloadProxies();
  const clearHealth = useClearProxyHealth();
  const testAll = useTestProxies();
  const testOne = useTestProxy();
  const cancelTest = useCancelTest();
  const importProxies = useImportProxies();
  const testRun = useProxyTestStatus();
  const { success, error, info } = useNotifications();

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [importText, setImportText] = useState('');
  const [timeoutSec, setTimeoutSec] = useState(5);
  const [concurrency, setConcurrency] = useState(80);
  const [autoRemoveDead, setAutoRemoveDead] = useState(true);
  const fileRef = useRef(null);

  const proxies = data?.webshare?.proxies || [];
  const total = data?.webshare?.total || 0;
  const enabled = data?.webshare?.enabled || 0;
  const globalOn = data?.proxiesEnabled !== false;
  const summary = data?.protocolSummary || {};

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return proxies.filter((p) => {
      if (filter === 'enabled' && !p.enabled) return false;
      if (filter === 'disabled' && p.enabled) return false;
      if (filter === 'http' && p.protocol !== 'http') return false;
      if (filter === 'socks5' && p.protocol !== 'socks5') return false;
      if (filter === 'untested' && p.lastTest) return false;
      if (term && !p.id.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [proxies, filter, search]);

  const testing = testRun?.status === 'running';
  const testPct = testing && testRun.total
    ? Math.round((testRun.done / testRun.total) * 100)
    : 0;

  const lastDoneAt = testRun?.status === 'done' ? testRun.finishedAt : null;
  useEffect(() => {
    if (!lastDoneAt) return;
    const parts = [`${testRun.ok} working`, `${testRun.failed} failed`];
    if (testRun.removedDead) parts.push(`${testRun.removedDead} removed`);
    success(`Done: ${parts.join(', ')}`);
  }, [lastDoneAt]);

  const toggle = (p) => setOne.mutate({ id: p.id, enabled: !p.enabled });
  const toggleGlobal = () => setGlobal.mutate(!globalOn, {
    onSuccess: ({ proxiesEnabled }) => info(`Proxies ${proxiesEnabled ? 'on' : 'off'}`),
    onError: (e) => error(e.message),
  });
  const onTestAll = (force = false) => testAll.mutate(
    { timeoutMs: Math.round(timeoutSec * 1000), concurrency, autoRemoveDead, force },
    {
      onSuccess: (r) => {
        if (r.alreadyRunning) info(`Test already running (${r.done}/${r.total})`);
        else info(`Testing ${r.total} proxies…`);
      },
      onError: (e) => error(e?.response?.data?.error || e.message),
    }
  );
  const onCancelTest = () => cancelTest.mutate(undefined, {
    onSuccess: () => info('Test cancelled'),
    onError: (e) => error(e.message),
  });
  const onTestOne = (p) => testOne.mutate(p.id, {
    onSuccess: (r) => r.ok
      ? success(`${p.id}: ${PROTO_LABEL[r.protocol]} ${r.latencyMs}ms`)
      : error(`${p.id}: ${r.error}`),
    onError: (e) => error(e.message),
  });
  const onImport = () => {
    if (!importText.trim()) return error('Paste proxy lines or choose a file');
    importProxies.mutate(importText, {
      onSuccess: (r) => {
        success(`Imported ${r.count} proxies`);
        setImportText('');
        setShowImport(false);
      },
      onError: (e) => error(e?.response?.data?.error || e.message),
    });
  };
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="h-full flex flex-col">
      <header className="px-5 py-3 flex items-center justify-between border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Proxies</h2>
          <span className="text-xs text-gray-500">
            <span className={enabled > 0 ? 'text-emerald-300' : 'text-gray-400'}>{enabled}</span>
            <span className="text-gray-500"> / {total} active</span>
            {isFetching && <span className="text-sky-400 ml-2">refreshing…</span>}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-lg leading-none">✕</button>
      </header>

      <div className="px-5 py-4 space-y-3 shrink-0 border-b border-gray-800 overflow-y-auto max-h-[60vh]">
        <label className="flex items-center justify-between gap-3 bg-gray-900/60 border border-gray-800 rounded-md px-3 py-2 cursor-pointer">
          <div>
            <div className="text-sm font-medium">Use proxies</div>
            <div className="text-xs text-gray-500">When off, all requests use your IP.</div>
          </div>
          <input type="checkbox" checked={globalOn} onChange={toggleGlobal} disabled={setGlobal.isPending} className="sr-only peer" />
          <span className="relative w-11 h-6 bg-gray-700 rounded-full peer-checked:bg-emerald-600 transition-colors shrink-0">
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${globalOn ? 'translate-x-5' : ''}`} />
          </span>
        </label>

        <div className="bg-gray-900/60 border border-gray-800 rounded-md p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onTestAll(false)}
              disabled={testAll.isPending || testing}
              className="btn-primary text-sm flex-1 min-w-[10rem]"
            >
              {testing ? `Testing ${testRun?.done || 0}/${testRun?.total || 0} · ${testPct}%` : `Test all (${total})`}
            </button>
            {testing ? (
              <button onClick={onCancelTest} className="btn-secondary text-xs">Cancel</button>
            ) : (
              <button onClick={() => onTestAll(true)} className="btn-ghost text-xs" title="Force restart even if stuck">
                ↻ Force
              </button>
            )}
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="btn-ghost text-xs"
              title="Test settings"
            >
              ⚙ Settings
            </button>
          </div>

          {testing && (
            <div>
              <div className="h-1.5 bg-gray-800 rounded overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all"
                  style={{ width: `${testPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                <span>
                  <span className="text-emerald-300">{testRun.ok}</span> ok ·{' '}
                  <span className="text-red-300">{testRun.failed}</span> fail
                </span>
                <span>{Math.round((Date.now() - testRun.startedAt) / 1000)}s</span>
              </div>
            </div>
          )}

          {showSettings && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800">
              <label className="text-xs text-gray-400">
                Timeout (s)
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={timeoutSec}
                  onChange={(e) => setTimeoutSec(Math.max(1, Math.min(30, Number(e.target.value) || 5)))}
                  className="input w-full mt-1 text-sm"
                />
              </label>
              <label className="text-xs text-gray-400">
                Concurrency
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={concurrency}
                  onChange={(e) => setConcurrency(Math.max(1, Math.min(200, Number(e.target.value) || 80)))}
                  className="input w-full mt-1 text-sm"
                />
              </label>
              <label className="col-span-2 text-xs text-gray-400 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRemoveDead}
                  onChange={(e) => setAutoRemoveDead(e.target.checked)}
                />
                Auto-remove dead proxies after testing
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-gray-400 px-1">
          <span className={`badge text-[10px] ${PROTO_STYLE.http}`}>HTTP {summary.http || 0}</span>
          <span className={`badge text-[10px] ${PROTO_STYLE.socks5}`}>SOCKS5 {summary.socks5 || 0}</span>
          {(summary.untested || 0) > 0 && <span className="text-amber-400">{summary.untested} untested</span>}
          {(summary.dead || 0) > 0 && <span className="text-red-400">{summary.dead} dead</span>}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setAll.mutate(true)} disabled={setAll.isPending} className="btn-secondary text-xs flex-1">Enable all</button>
          <button onClick={() => setAll.mutate(false)} disabled={setAll.isPending} className="btn-secondary text-xs flex-1">Disable all</button>
          <button onClick={() => setShowImport((v) => !v)} className="btn-secondary text-xs flex-1">
            {showImport ? 'Hide import' : 'Import'}
          </button>
          <button onClick={() => reload.mutate()} disabled={reload.isPending} className="btn-ghost text-xs" title="Reload proxy file from disk">↻</button>
          <button onClick={() => clearHealth.mutate()} disabled={clearHealth.isPending} className="btn-ghost text-xs" title="Clear cached rate-limit flags">⚠</button>
        </div>

        {showImport && (
          <div className="space-y-2 border border-gray-800 rounded-md p-3 bg-gray-900/40">
            <div className="text-xs text-gray-400">
              One per line: <code className="text-gray-300">ip:port</code> · <code className="text-gray-300">ip:port:user:pass</code> · <code className="text-gray-300">http://user:pass@ip:port</code> · <code className="text-gray-300">socks5://...</code>
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={5}
              placeholder="Paste proxy list…"
              className="input w-full font-mono text-xs"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-sm">
                Choose file
              </button>
              <input ref={fileRef} type="file" accept=".txt,.csv,text/plain" className="hidden" onChange={onFile} />
              <button onClick={onImport} disabled={importProxies.isPending} className="btn-primary text-sm flex-1">
                {importProxies.isPending ? 'Importing…' : 'Import & replace'}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ip:port…"
            className="input flex-1"
          />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input w-32">
            {FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>

        {data?.suborbit && (
          <div className="text-[11px] text-gray-500">
            Suborbit (inventory/market):{' '}
            {data.suborbit.configured
              ? <span className="text-emerald-400">configured</span>
              : <span className="text-red-400">missing env vars</span>}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="text-gray-500 text-sm py-12 text-center">Loading proxies…</div>
        ) : filtered.length === 0 ? (
          <div className="text-gray-500 text-sm py-12 text-center">No proxies match.</div>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((p) => (
              <ProxyRow
                key={p.id}
                p={p}
                onToggle={() => toggle(p)}
                onTest={() => onTestOne(p)}
                busy={setOne.isPending}
                testing={testOne.isPending}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ProxyRow({ p, onToggle, onTest, busy, testing }) {
  const dot = !p.enabled
    ? 'bg-gray-600'
    : p.healthy === false
      ? 'bg-amber-500'
      : p.lastTest?.ok
        ? 'bg-emerald-500'
        : 'bg-sky-500';
  const t = p.lastTest;
  const proto = t?.protocol || p.protocol;
  const protoClass = PROTO_STYLE[proto] || 'bg-gray-700 text-gray-300';

  return (
    <li className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-800/40">
      <span className={`w-2 h-2 rounded-full ${dot} shrink-0`} />
      <span className="text-xs font-mono truncate flex-1">{p.id}</span>
      {proto && (
        <span className={`badge text-[10px] uppercase ${protoClass}`}>{PROTO_LABEL[proto] || proto}</span>
      )}
      {t?.ok && (
        <span className="text-[10px] text-emerald-400 tabular-nums w-12 text-right">{t.latencyMs}ms</span>
      )}
      {t && !t.ok && (
        <span className="text-[10px] text-red-400 w-12 text-right truncate" title={t.error}>{t.error || 'fail'}</span>
      )}
      <button onClick={onTest} disabled={testing} className="text-[10px] text-sky-400 hover:text-sky-300 shrink-0 px-1">
        Test
      </button>
      <label className="inline-flex items-center cursor-pointer shrink-0">
        <input type="checkbox" checked={p.enabled} onChange={onToggle} disabled={busy} className="sr-only peer" />
        <span className="relative w-8 h-4 bg-gray-700 rounded-full peer-checked:bg-sky-600 transition-colors">
          <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${p.enabled ? 'translate-x-4' : ''}`} />
        </span>
      </label>
    </li>
  );
}
