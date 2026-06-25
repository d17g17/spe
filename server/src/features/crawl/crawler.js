'use strict';

const steamApi = require('../../steam/api');
const transform = require('../../steam/transform');
const profileRepo = require('../profiles/repo');
const cs2Service = require('../cs2/service');
const socketBus = require('../../socket');
const logger = require('../../utils/logger');

const active = new Map();
const cancelled = new Set();

const emit = (steamId, event, payload) => {
  socketBus.emit(`crawl:${steamId}:${event}`, { steamId, ...payload });
  socketBus.emit(`crawl:${event}`, { steamId, ...payload });
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

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const schedulePrune = (steamId) => {
  setTimeout(() => active.delete(steamId), 300_000).unref();
};

const evaluateConditions = (profile, conditions) => {
  if (conditions.noVacBan && profile.vacBanned) return false;
  if (conditions.noGameBan && profile.gameBanned) return false;
  if (conditions.noTradeBan && profile.tradeBanned) return false;
  if (conditions.isPublic && profile.communityVisibilityState !== 3) return false;
  if (conditions.cyrillicName && !profile.hasCyrillic) return false;
  if (conditions.country && conditions.country.trim() !== '') {
    if (!profile.country || profile.country.toUpperCase() !== conditions.country.toUpperCase()) return false;
  }
  return true;
};

const run = async (rootSteamId, options) => {
  const { depth = 1, conditions = {}, maxDiscoveries = 5000 } = options;
  
  let currentLevelIds = [rootSteamId];
  const visited = new Set([rootSteamId]);
  
  let processed = 0;
  let matches = 0;
  let errors = 0;
  
  setStatus(rootSteamId, { status: 'in_progress', processed, matches, errors, totalDiscovered: visited.size });
  emit(rootSteamId, 'progress', getStatus(rootSteamId));

  for (let currentDepth = 0; currentDepth <= depth; currentDepth++) {
    const nextLevelIds = [];
    
    const batches = chunk(currentLevelIds, 100);
    for (const batch of batches) {
      if (cancelled.has(rootSteamId)) break;
      try {
        const existingSet = new Set(await profileRepo.listIds({ steamIds: batch }));
        const newBatch = batch.filter(id => !existingSet.has(id));
        if (newBatch.length === 0) continue;

        const [summaries, bans] = await Promise.all([
          steamApi.getPlayerSummaries(newBatch).catch(() => []),
          steamApi.getPlayerBans(newBatch).catch(() => []),
        ]);
        
        const bansById = new Map(bans.map((b) => [b.SteamId, b]));
        
        const preliminaryMatched = [];
        
        for (const s of summaries) {
          const shape = transform.summaryToDbShape(s);
          const banShape = transform.bansToDbShape(bansById.get(s.steamid));
          const profile = { ...shape, ...banShape };
          
          if (evaluateConditions(profile, conditions)) {
             preliminaryMatched.push(profile);
          }
        }
        
        const matchedShapes = [];
        
        if (conditions.minCs2Value > 0 && preliminaryMatched.length > 0) {
           const invChunks = chunk(preliminaryMatched, 10);
           for (const invBatch of invChunks) {
              if (cancelled.has(rootSteamId)) break;
              await Promise.all(invBatch.map(async (profile) => {
                 try {
                    const inv = await cs2Service.fetchAndStore(profile.steamId, { persist: false });
                    if (inv && (inv.totalValueUsd >= conditions.minCs2Value || inv.totalValueWithStickersUsd >= conditions.minCs2Value)) {
                       matchedShapes.push(profile);
                       await cs2Service.upsert(profile.steamId, inv);
                    }
                 } catch (e) {
                    logger.warn(`Failed to fetch inventory for ${profile.steamId} during crawl: ${e.message}`);
                 }
              }));
           }
        } else {
           matchedShapes.push(...preliminaryMatched);
        }
        
        if (matchedShapes.length > 0) {
           await profileRepo.bulkUpsertProfiles(matchedShapes);
           matches += matchedShapes.length;
        }
        processed += newBatch.length;
        
        setStatus(rootSteamId, { processed, matches, errors, totalDiscovered: visited.size });
        emit(rootSteamId, 'progress', getStatus(rootSteamId));
        
      } catch (err) {
        errors += batch.length;
        logger.warn(`crawl batch failed: ${err.message}`);
      }
    }
    
    if (currentDepth < depth) {
      const friendBatches = chunk(currentLevelIds, 5);
      for (const batch of friendBatches) {
        if (cancelled.has(rootSteamId)) break;
        await Promise.all(batch.map(async (id) => {
          try {
             const friends = await steamApi.getFriendList(id);
             for (const f of friends) {
                if (visited.size >= maxDiscoveries) break;
                if (!visited.has(f.steamid)) {
                   visited.add(f.steamid);
                   nextLevelIds.push(f.steamid);
                }
             }
          } catch(e) {
             // private profile or error, ignore
          }
        }));
        setStatus(rootSteamId, { totalDiscovered: visited.size });
        emit(rootSteamId, 'progress', getStatus(rootSteamId));
      }
    }
    
    currentLevelIds = nextLevelIds;
  }
  
  if (cancelled.has(rootSteamId)) {
    cancelled.delete(rootSteamId);
    return; // status already set by cancel()
  }

  const done = setStatus(rootSteamId, { status: 'complete', processed, matches, errors, totalDiscovered: visited.size });
  emit(rootSteamId, 'complete', done);
  schedulePrune(rootSteamId);
};

const start = async (steamId, options) => {
  const existing = active.get(steamId);
  if (existing && (existing.status === 'starting' || existing.status === 'in_progress')) {
    return existing;
  }
  const state = setStatus(steamId, { status: 'starting', processed: 0, matches: 0, errors: 0, totalDiscovered: 0 });
  emit(steamId, 'progress', state);
  setImmediate(() => run(steamId, options).catch((err) => {
    logger.error(`crawl failed for ${steamId}: ${err.message}`);
    const final = setStatus(steamId, { status: 'error', error: err.message });
    emit(steamId, 'error', final);
    schedulePrune(steamId);
  }));
  return state;
};

const cancel = (steamId) => {
  cancelled.add(steamId);
  const current = active.get(steamId);
  if (current && (current.status === 'in_progress' || current.status === 'starting')) {
    const final = setStatus(steamId, { status: 'cancelled' });
    emit(steamId, 'complete', final);
    schedulePrune(steamId);
    setTimeout(() => cancelled.delete(steamId), 60000).unref();
    return final;
  }
  return getStatus(steamId);
};

module.exports = { start, getStatus, listActive, cancel };
