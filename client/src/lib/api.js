import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export const apiClient = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

const unwrap = (p) => p.then((r) => r.data);

export const api = {
  profiles: {
    list: (params) => unwrap(apiClient.get('/profiles', { params })),
    get: (id) => unwrap(apiClient.get(`/profiles/${id}`)),
    fetch: (id, force = false) => unwrap(apiClient.get(`/profiles/${id}/fetch`, { params: { force } })),
    delete: (id) => unwrap(apiClient.delete(`/profiles/${id}`)),
    deleteAll: () => unwrap(apiClient.delete('/profiles')),
    inventoryErrors: (steamIds) => unwrap(apiClient.post('/profiles/inventory-errors', { steamIds })),
  },
  friends: {
    list: (id, params) => unwrap(apiClient.get(`/friends/${id}`, { params })),
    fetch: (id) => unwrap(apiClient.post(`/friends/${id}/fetch`)),
    status: (id) => unwrap(apiClient.get(`/friends/${id}/status`)),
    active: () => unwrap(apiClient.get('/friends/active')),
  },
  cs2: {
    get: (id) => unwrap(apiClient.get(`/cs2/${id}`)),
    fetch: (id) => unwrap(apiClient.post(`/cs2/${id}/fetch`)),
    stats: () => unwrap(apiClient.get('/cs2/stats')),
  },
  prices: {
    export: () => unwrap(apiClient.get('/prices/export')),
    import: (prices) => unwrap(apiClient.post('/prices/import', { prices })),
    clear: () => unwrap(apiClient.delete('/prices/clear')),
    stats: () => unwrap(apiClient.get('/prices/stats')),
  },
  health: () => unwrap(apiClient.get('/health')),
};
