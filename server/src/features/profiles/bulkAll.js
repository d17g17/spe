'use strict';

const profilesService = require('./service');
const profilesRepo = require('./repo');
const cs2Service = require('../cs2/service');
const socketBus = require('../../socket');
const logger = require('../../utils/logger');
const { AdaptiveConcurrency, isRateLimitError } = require('../../utils/adaptiveConcurrency');

const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 20;

let state = {
  status: 'idle',
  total: 0,
  processed: 0,
  ok: 0,
  errors: 0,
  errorLog: [],
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
    errorLog: [],
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

const start = async ({
  concurrency = DEFAULT_CONCURRENCY,
  adaptive = false,
  includeCs2 = true,
  force = false,
  sortBy,
  sortDir,
  filters,
  search,
} = {}) => {
  if (state.status === 'running') return get();
  const ids = await profilesRepo.listIds({ sortBy, sortDir, filters, search });
  if (ids.length === 0) {
    state = { ...state, status: 'idle', total: 0 };
    return get();
  }

  const initial = adaptive
    ? 4
    : Math.max(1, Math.min(Number(concurrency) || DEFAULT_CONCURRENCY, MAX_CONCURRENCY));

  state = {
    status: 'running',
    total: ids.length,
    processed: 0,
    ok: 0,
    errors: 0,
    errorLog: [],
    startedAt: Date.now(),
    finishedAt: null,
    currentId: null,
    concurrency: initial,
    adaptive: Boolean(adaptive),
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
  const ctrl = new AdaptiveConcurrency({
    // In adaptive mode let the controller pick its starting target (8). In
    // fixed mode honour the slider value the user picked.
    initial: state.adaptive ? undefined : state.concurrency,
    min: 1,
    max: MAX_CONCURRENCY,
    adaptive: state.adaptive,
  });
  ctrl.setOnChange(({ target, reason }) => {
    state.concurrency = target;
    logger.info(`bulkAll adaptive concurrency -> ${target} (${reason})`);
    emit();
  });

  let cursor = 0;
  let lastEmit = 0;

  const processOne = async (id) => {
    state.currentId = id;
    let ok = false;
    let rlError = null;
    try {
      const r = await profilesService.getOrFetch(id, { force: state.force });
      if (r.error) {
        state.errors += 1;
        state.errorLog.push({ id, stage: 'profile', error: r.error });
        if (isRateLimitError(r.error)) rlError = r.error;
      } else {
        ok = true;
        state.ok += 1;
        if (state.includeCs2) {
          try {
            await cs2Service.fetchAndStore(id);
          } catch (err) {
            logger.warn(`bulkAll cs2 ${id} failed: ${err.message}`);
            state.errorLog.push({ id, stage: 'cs2', error: err.message });
            if (isRateLimitError(err)) rlError = err.message;
          }
        }
        socketBus.emit('profile:update', { steamId: id, profile: r.profile });
      }
    } catch (err) {
      logger.warn(`bulkAll profile ${id} failed: ${err.message}`);
      state.errors += 1;
      state.errorLog.push({ id, stage: 'profile', error: err.message });
      if (isRateLimitError(err)) rlError = err.message;
    }
    state.processed += 1;
    const now = Date.now();
    if (now - lastEmit > 400 || state.processed === state.total) {
      lastEmit = now;
      emit();
    }
    return { ok, rateLimited: Boolean(rlError), error: rlError };
  };

  // Spawn up to MAX_CONCURRENCY workers; each waits on the adaptive semaphore
  // before pulling the next item, so target can shrink/grow on the fly.
  const worker = async () => {
    while (state.status === 'running' && cursor < ids.length) {
      await ctrl.acquire();
      if (state.status !== 'running' || cursor >= ids.length) {
        ctrl.release({ ok: true });
        return;
      }
      const id = ids[cursor++];
      const result = await processOne(id);
      ctrl.release(result);
    }
  };

  const workerCount = Math.min(MAX_CONCURRENCY, ids.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (state.status === 'running') state.status = 'complete';
  state.finishedAt = Date.now();
  state.currentId = null;
  emit();
};

module.exports = { start, cancel, get, reset };
