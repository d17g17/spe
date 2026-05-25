'use strict';

const { models } = require('../../db');
const profilesService = require('./service');
const cs2Service = require('../cs2/service');
const socketBus = require('../../socket');
const logger = require('../../utils/logger');

const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 8;

let state = {
  status: 'idle',
  total: 0,
  processed: 0,
  ok: 0,
  errors: 0,
  startedAt: null,
  finishedAt: null,
  currentId: null,
};

const emit = () => socketBus.emit('bulkAll:progress', { ...state });
const get = () => ({ ...state });

const reset = () => {
  state = {
    status: 'idle',
    total: 0,
    processed: 0,
    ok: 0,
    errors: 0,
    startedAt: null,
    finishedAt: null,
    currentId: null,
  };
};

const cancel = () => {
  if (state.status === 'running') {
    state.status = 'cancelled';
    state.finishedAt = Date.now();
    emit();
  }
  return get();
};

const start = async ({ concurrency = DEFAULT_CONCURRENCY, includeCs2 = true, force = false } = {}) => {
  if (state.status === 'running') return get();
  const rows = await models.Profile.findAll({ attributes: ['steamId'], raw: true });
  const ids = rows.map((r) => r.steamId);
  if (ids.length === 0) {
    state = { ...state, status: 'idle', total: 0 };
    return get();
  }

  state = {
    status: 'running',
    total: ids.length,
    processed: 0,
    ok: 0,
    errors: 0,
    startedAt: Date.now(),
    finishedAt: null,
    currentId: null,
    concurrency: Math.max(1, Math.min(Number(concurrency) || DEFAULT_CONCURRENCY, MAX_CONCURRENCY)),
    includeCs2: Boolean(includeCs2),
    force: Boolean(force),
  };
  emit();

  setImmediate(() => run(ids).catch((err) => {
    logger.error(`bulkAll failed: ${err.message}`);
    state.status = 'error';
    state.error = err.message;
    state.finishedAt = Date.now();
    emit();
  }));
  return get();
};

const run = async (ids) => {
  let cursor = 0;
  let lastEmit = 0;
  const worker = async () => {
    while (cursor < ids.length && state.status === 'running') {
      const id = ids[cursor++];
      state.currentId = id;
      try {
        const r = await profilesService.getOrFetch(id, { force: state.force });
        if (r.error) {
          state.errors += 1;
        } else {
          state.ok += 1;
          if (state.includeCs2) {
            try {
              await cs2Service.fetchAndStore(id);
            } catch (err) {
              logger.warn(`bulkAll cs2 ${id} failed: ${err.message}`);
            }
          }
          socketBus.emit('profile:update', { steamId: id, profile: r.profile });
        }
      } catch (err) {
        logger.warn(`bulkAll profile ${id} failed: ${err.message}`);
        state.errors += 1;
      }
      state.processed += 1;
      const now = Date.now();
      if (now - lastEmit > 400 || state.processed === state.total) {
        lastEmit = now;
        emit();
      }
    }
  };

  const conc = Math.max(1, Math.min(state.concurrency || DEFAULT_CONCURRENCY, MAX_CONCURRENCY));
  await Promise.all(Array.from({ length: Math.min(conc, ids.length) }, () => worker()));
  if (state.status === 'running') state.status = 'complete';
  state.finishedAt = Date.now();
  state.currentId = null;
  emit();
};

module.exports = { start, cancel, get, reset };
