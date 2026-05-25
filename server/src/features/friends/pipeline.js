'use strict';

const repo = require('./repo');
const steamApi = require('../../steam/api');
const transform = require('../../steam/transform');
const socketBus = require('../../socket');
const config = require('../../config');
const logger = require('../../utils/logger');

const active = new Map();

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const emit = (steamId, event, payload) => {
  socketBus.emit(`friendFetch:${steamId}:${event}`, { steamId, ...payload });
  socketBus.emit(`friendFetch:${event}`, { steamId, ...payload });
};

const setStatus = (steamId, patch) => {
  const current = active.get(steamId) || {};
  const next = { ...current, ...patch, updatedAt: Date.now() };
  active.set(steamId, next);
  return next;
};

const getStatus = (steamId) => active.get(steamId) || { status: 'idle' };

const listActive = () => {
  const out = {};
  for (const [k, v] of active.entries()) out[k] = v;
  return out;
};

const start = async (steamId) => {
  const existing = active.get(steamId);
  if (existing && (existing.status === 'starting' || existing.status === 'in_progress')) {
    return existing;
  }
  const state = setStatus(steamId, { status: 'starting', processed: 0, total: 0, errors: 0 });
  emit(steamId, 'progress', state);
  setImmediate(() => run(steamId).catch((err) => {
    logger.error(`friend fetch failed for ${steamId}: ${err.message}`);
    const final = setStatus(steamId, { status: 'error', error: err.message });
    emit(steamId, 'error', final);
    schedulePrune(steamId);
  }));
  return state;
};

const schedulePrune = (steamId) => {
  setTimeout(() => active.delete(steamId), 60_000).unref();
};

const run = async (steamId) => {
  const list = await steamApi.getFriendList(steamId);
  const friendShapes = transform.friendsToShape(list);
  const friendIds = friendShapes.map((f) => f.steamId);

  setStatus(steamId, { status: 'in_progress', total: friendIds.length, processed: 0, errors: 0 });
  emit(steamId, 'progress', getStatus(steamId));

  await repo.setFriendsCount(steamId, friendIds.length);

  if (friendIds.length === 0) {
    await repo.replaceFriendships(steamId, []);
    const done = setStatus(steamId, { status: 'complete', processed: 0, total: 0 });
    emit(steamId, 'complete', done);
    schedulePrune(steamId);
    return;
  }

  const existing = await repo.existingProfileIds(friendIds);
  const missing = friendIds.filter((id) => !existing.has(id));
  if (missing.length > 0) {
    await repo.bulkInsertPlaceholders(missing);
  }

  await repo.replaceFriendships(steamId, friendShapes);

  let processed = 0;
  let errors = 0;
  const batches = chunk(friendIds, config.friendBatchSize);

  for (const batch of batches) {
    try {
      const [summaries, bans] = await Promise.all([
        steamApi.getPlayerSummaries(batch).catch(() => []),
        steamApi.getPlayerBans(batch).catch(() => []),
      ]);
      const bansById = new Map(bans.map((b) => [b.SteamId, b]));
      const shapes = summaries.map((s) => {
        const shape = transform.summaryToDbShape(s);
        const banShape = transform.bansToDbShape(bansById.get(s.steamid));
        return { ...shape, ...banShape };
      });
      await repo.bulkUpsertProfiles(shapes);
      processed += batch.length;
    } catch (err) {
      errors += batch.length;
      logger.warn(`friend batch failed: ${err.message}`);
    }
    setStatus(steamId, { processed, errors });
    emit(steamId, 'progress', getStatus(steamId));
  }

  const done = setStatus(steamId, { status: 'complete', processed, errors, total: friendIds.length });
  emit(steamId, 'complete', done);
  schedulePrune(steamId);
};

module.exports = { start, getStatus, listActive };
