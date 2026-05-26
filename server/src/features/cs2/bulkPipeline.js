'use strict';

const { Op } = require('sequelize');
const { models } = require('../../db');
const cs2Service = require('./service');
const profilesService = require('../profiles/service');
const profilesRepo = require('../profiles/repo');
const friendsRepo = require('../friends/repo');
const socketBus = require('../../socket');
const logger = require('../../utils/logger');
const { AdaptiveConcurrency, isRateLimitError } = require('../../utils/adaptiveConcurrency');

const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 20;
const SKIP_RECENT_MS = 24 * 3600_000;

const active = new Map();

const emit = (ownerId, event, payload) => {
  socketBus.emit(`bulkCs2:${ownerId}:${event}`, { ownerId, ...payload });
  socketBus.emit(`bulkCs2:${event}`, { ownerId, ...payload });
};

const setStatus = (ownerId, patch) => {
  const cur = active.get(ownerId) || {};
  const next = { ...cur, ...patch, updatedAt: Date.now() };
  active.set(ownerId, next);
  return next;
};

const getStatus = (ownerId) => active.get(ownerId) || { status: 'idle' };
const listActive = () => Object.fromEntries(active.entries());

const schedulePrune = (ownerId) => {
  setTimeout(() => active.delete(ownerId), 120_000).unref();
};

const start = async (ownerId, {
  force = false,
  concurrency,
  adaptive = false,
  sortBy,
  sortDir,
  filters,
  search,
} = {}) => {
  const existing = active.get(ownerId);
  if (existing && (existing.status === 'starting' || existing.status === 'in_progress')) {
    return existing;
  }
  const friendships = await models.Friendship.findAll({
    where: { profileSteamId: ownerId },
    attributes: ['friendSteamId'],
    raw: true,
  });
  const friendIds = friendships.map((f) => f.friendSteamId);

  // Apply caller-supplied sort + filters by piggy-backing on profilesRepo so the
  // bulk job processes friends in the exact same order/selection the user has
  // chosen on the home page.
  let ids = friendIds;
  if (friendIds.length > 0 && (sortBy || sortDir || filters || search)) {
    try {
      ids = await profilesRepo.listIds({ sortBy, sortDir, filters, search, steamIds: friendIds });
      // Friends without a Profile row are dropped by listIds; preserve them by
      // appending to the end so we still try to fetch them.
      if (ids.length < friendIds.length) {
        const seen = new Set(ids);
        for (const id of friendIds) if (!seen.has(id)) ids.push(id);
      }
    } catch (err) {
      logger.warn(`bulk cs2 friend sort/filter failed, falling back to raw order: ${err.message}`);
      ids = friendIds;
    }
  }

  if (ids.length === 0) {
    const done = setStatus(ownerId, { status: 'complete', total: 0, processed: 0, errors: 0, skipped: 0 });
    emit(ownerId, 'complete', done);
    schedulePrune(ownerId);
    return done;
  }

  let toFetch = ids;
  let skipped = 0;
  if (!force) {
    const rows = await models.CS2Inventory.findAll({
      where: {
        profileId: { [Op.in]: ids },
        lastChecked: { [Op.gt]: new Date(Date.now() - SKIP_RECENT_MS) },
      },
      attributes: ['profileId'],
      raw: true,
    });
    const recent = new Set(rows.map((r) => r.profileId));
    skipped = recent.size;
    toFetch = ids.filter((id) => !recent.has(id));
  }

  const initial = adaptive
    ? 4
    : Math.max(1, Math.min(Number(concurrency) || DEFAULT_CONCURRENCY, MAX_CONCURRENCY));
  const state = setStatus(ownerId, {
    status: 'starting',
    total: ids.length,
    toFetch: toFetch.length,
    processed: 0,
    errors: 0,
    errorLog: [],
    skipped,
    private: 0,
    empty: 0,
    checked: 0,
    concurrency: initial,
    adaptive: Boolean(adaptive),
  });
  emit(ownerId, 'progress', state);

  setImmediate(() => run(ownerId, toFetch, { initial, adaptive: Boolean(adaptive) }).catch((err) => {
    logger.error(`bulk cs2 failed for ${ownerId}: ${err.message}`);
    const final = setStatus(ownerId, { status: 'error', error: err.message });
    emit(ownerId, 'error', final);
    schedulePrune(ownerId);
  }));
  return state;
};

const run = async (ownerId, ids, { initial = DEFAULT_CONCURRENCY, adaptive = false } = {}) => {
  setStatus(ownerId, { status: 'in_progress' });
  const ctrl = new AdaptiveConcurrency({
    initial: adaptive ? undefined : initial,
    min: 1,
    max: MAX_CONCURRENCY,
    adaptive,
  });
  ctrl.setOnChange(({ target, reason }) => {
    setStatus(ownerId, { concurrency: target });
    logger.info(`bulk cs2 ${ownerId} adaptive concurrency -> ${target} (${reason})`);
    emit(ownerId, 'progress', getStatus(ownerId));
  });

  let cursor = 0;

  const processOne = async (friendId) => {
    let ok = true;
    let rlError = null;
    try {
      let profileErr = null;
      let cs2Err = null;
      const [profileRes, invRow] = await Promise.all([
        profilesService.getOrFetch(friendId, { force: true }).catch((err) => {
          logger.warn(`bulk profile ${friendId} failed: ${err.message}`);
          profileErr = err.message;
          return null;
        }),
        cs2Service.fetchAndStore(friendId).catch((err) => {
          logger.warn(`bulk cs2 ${friendId} failed: ${err.message}`);
          cs2Err = err.message;
          return null;
        }),
      ]);
      const status = invRow?.status || (invRow === null ? 'error' : 'unknown');
      const cur = active.get(ownerId) || {};
      const errorLog = (cur.errorLog || []).slice();
      if (profileErr) errorLog.push({ id: friendId, stage: 'profile', error: profileErr });
      if (cs2Err) errorLog.push({ id: friendId, stage: 'cs2', error: cs2Err });
      else if (invRow?.status === 'error') errorLog.push({ id: friendId, stage: 'cs2', error: invRow.skipReason || 'error' });
      setStatus(ownerId, {
        processed: (cur.processed || 0) + 1,
        checked: (cur.checked || 0) + (status === 'checked' ? 1 : 0),
        private: (cur.private || 0) + (status === 'private' ? 1 : 0),
        empty: (cur.empty || 0) + (status === 'empty' ? 1 : 0),
        errors: (cur.errors || 0) + (status === 'error' ? 1 : 0),
        errorLog,
      });
      if (invRow) socketBus.emit('inventory:update', { steamId: friendId, inventory: invRow });
      if (profileRes?.profile) socketBus.emit('profile:update', { steamId: friendId, profile: profileRes.profile });

      if (status === 'error') ok = false;
      if (isRateLimitError(profileErr) || isRateLimitError(cs2Err) || isRateLimitError(invRow?.skipReason)) {
        rlError = profileErr || cs2Err || invRow?.skipReason;
        ok = false;
      }
    } catch (err) {
      const cur = active.get(ownerId) || {};
      const errorLog = (cur.errorLog || []).slice();
      errorLog.push({ id: friendId, stage: 'worker', error: err.message });
      setStatus(ownerId, { processed: (cur.processed || 0) + 1, errors: (cur.errors || 0) + 1, errorLog });
      logger.warn(`bulk worker ${friendId} failed: ${err.message}`);
      ok = false;
      if (isRateLimitError(err)) rlError = err.message;
    }
    emit(ownerId, 'progress', getStatus(ownerId));
    return { ok, rateLimited: Boolean(rlError), error: rlError };
  };

  const worker = async () => {
    while (cursor < ids.length) {
      await ctrl.acquire();
      if (cursor >= ids.length) { ctrl.release({ ok: true }); return; }
      const friendId = ids[cursor++];
      const result = await processOne(friendId);
      ctrl.release(result);
    }
  };

  const workerCount = Math.min(MAX_CONCURRENCY, ids.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const final = setStatus(ownerId, { status: 'complete' });
  emit(ownerId, 'complete', final);
  schedulePrune(ownerId);
};

module.exports = { start, getStatus, listActive };
