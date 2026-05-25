'use strict';

const { Op } = require('sequelize');
const { models } = require('../../db');
const cs2Service = require('./service');
const profilesService = require('../profiles/service');
const socketBus = require('../../socket');
const logger = require('../../utils/logger');

const CONCURRENCY = 4;
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

const start = async (ownerId, { force = false } = {}) => {
  const existing = active.get(ownerId);
  if (existing && (existing.status === 'starting' || existing.status === 'in_progress')) {
    return existing;
  }
  const friendships = await models.Friendship.findAll({
    where: { profileSteamId: ownerId },
    attributes: ['friendSteamId'],
    raw: true,
  });
  const ids = friendships.map((f) => f.friendSteamId);
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

  const state = setStatus(ownerId, {
    status: 'starting',
    total: ids.length,
    toFetch: toFetch.length,
    processed: 0,
    errors: 0,
    skipped,
    private: 0,
    empty: 0,
    checked: 0,
  });
  emit(ownerId, 'progress', state);

  setImmediate(() => run(ownerId, toFetch).catch((err) => {
    logger.error(`bulk cs2 failed for ${ownerId}: ${err.message}`);
    const final = setStatus(ownerId, { status: 'error', error: err.message });
    emit(ownerId, 'error', final);
    schedulePrune(ownerId);
  }));
  return state;
};

const run = async (ownerId, ids) => {
  setStatus(ownerId, { status: 'in_progress' });

  let cursor = 0;
  const worker = async () => {
    while (cursor < ids.length) {
      const friendId = ids[cursor++];
      try {
        const [profileRes, invRow] = await Promise.all([
          profilesService.getOrFetch(friendId, { force: true }).catch((err) => {
            logger.warn(`bulk profile ${friendId} failed: ${err.message}`);
            return null;
          }),
          cs2Service.fetchAndStore(friendId).catch((err) => {
            logger.warn(`bulk cs2 ${friendId} failed: ${err.message}`);
            return null;
          }),
        ]);
        const status = invRow?.status || (invRow === null ? 'error' : 'unknown');
        const cur = active.get(ownerId) || {};
        setStatus(ownerId, {
          processed: (cur.processed || 0) + 1,
          checked: (cur.checked || 0) + (status === 'checked' ? 1 : 0),
          private: (cur.private || 0) + (status === 'private' ? 1 : 0),
          empty: (cur.empty || 0) + (status === 'empty' ? 1 : 0),
          errors: (cur.errors || 0) + (status === 'error' ? 1 : 0),
        });
        if (invRow) socketBus.emit('inventory:update', { steamId: friendId, inventory: invRow });
        if (profileRes?.profile) socketBus.emit('profile:update', { steamId: friendId, profile: profileRes.profile });
      } catch (err) {
        const cur = active.get(ownerId) || {};
        setStatus(ownerId, { processed: (cur.processed || 0) + 1, errors: (cur.errors || 0) + 1 });
        logger.warn(`bulk worker ${friendId} failed: ${err.message}`);
      }
      emit(ownerId, 'progress', getStatus(ownerId));
    }
  };

  const workers = Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => worker());
  await Promise.all(workers);

  const final = setStatus(ownerId, { status: 'complete' });
  emit(ownerId, 'complete', final);
  schedulePrune(ownerId);
};

module.exports = { start, getStatus, listActive };
