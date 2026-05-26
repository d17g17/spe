import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export const apiClient = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

const LONG = { timeout: 120000 };

const unwrap = (p) => p.then((r) => r.data);
const enc = (v) => encodeURIComponent(String(v ?? ''));

export const api = {
  profiles: {
    list: (params) => unwrap(apiClient.get('/profiles', { params })),
    get: (id) => unwrap(apiClient.get(`/profiles/${enc(id)}`)),
    fetch: (id, force = false) => unwrap(apiClient.get(`/profiles/${enc(id)}/fetch`, { params: { force } })),
    delete: (id) => unwrap(apiClient.delete(`/profiles/${enc(id)}`)),
    deleteAll: () => unwrap(apiClient.delete('/profiles')),
    inventoryErrors: (steamIds) => unwrap(apiClient.post('/profiles/inventory-errors', { steamIds })),
    fetchAllStart: (opts = {}) => unwrap(apiClient.post('/profiles/fetch-all', opts)),
    fetchAllStatus: () => unwrap(apiClient.get('/profiles/fetch-all/status')),
    fetchAllCancel: () => unwrap(apiClient.post('/profiles/fetch-all/cancel')),
  },
  friends: {
    list: (id, params) => unwrap(apiClient.get(`/friends/${enc(id)}`, { params })),
    fetch: (id) => unwrap(apiClient.post(`/friends/${enc(id)}/fetch`)),
    status: (id) => unwrap(apiClient.get(`/friends/${enc(id)}/status`)),
    active: () => unwrap(apiClient.get('/friends/active')),
  },
  cs2: {
    get: (id) => unwrap(apiClient.get(`/cs2/${enc(id)}`)),
    fetch: (id) => unwrap(apiClient.post(`/cs2/${enc(id)}/fetch`, undefined, LONG)),
    stats: () => unwrap(apiClient.get('/cs2/stats')),
    bulkStart: (id, opts = {}) =>
      unwrap(apiClient.post(`/cs2/bulk/${enc(id)}`, opts)),
    bulkStatus: (id) => unwrap(apiClient.get(`/cs2/bulk/${enc(id)}/status`)),
    bulkActive: () => unwrap(apiClient.get('/cs2/bulk/active')),
  },
  prices: {
    export: () => unwrap(apiClient.get('/prices/export')),
    import: (prices) => unwrap(apiClient.post('/prices/import', { prices })),
    clear: () => unwrap(apiClient.delete('/prices/clear')),
    stats: () => unwrap(apiClient.get('/prices/stats')),
  },
  proxies: {
    list: () => unwrap(apiClient.get('/proxies')),
    setOne: (id, enabled) => unwrap(apiClient.put(`/proxies/${enc(id)}`, { enabled })),
    setAll: (enabled) => unwrap(apiClient.put('/proxies/all', { enabled })),
    setGlobal: (enabled) => unwrap(apiClient.put('/proxies/global', { enabled })),
    reload: () => unwrap(apiClient.post('/proxies/reload')),
    clearHealth: () => unwrap(apiClient.post('/proxies/clear-health')),
    keepWorking: () => unwrap(apiClient.post('/proxies/keep-working')),
    removeDead: () => unwrap(apiClient.post('/proxies/remove-dead')),
    testAll: (opts = {}) => unwrap(apiClient.post('/proxies/test', opts)),
    testCancel: () => unwrap(apiClient.post('/proxies/test/cancel')),
    testStatus: () => unwrap(apiClient.get('/proxies/test/status')),
    testOne: (id) => unwrap(apiClient.post(`/proxies/${enc(id)}/test`, undefined, LONG)),
    importText: (text) => unwrap(apiClient.post('/proxies/import', text, {
      headers: { 'Content-Type': 'text/plain' },
    })),
    exportText: (params = {}) => apiClient.get('/proxies/export', {
      params,
      responseType: 'text',
      transformResponse: (v) => v,
    }).then((r) => r.data),
  },
  health: () => unwrap(apiClient.get('/health')),
};
