'use strict';

const service = require('./service');
const bulkAll = require('./bulkAll');
const logger = require('../../utils/logger');

const list = async (req, res, next) => {
  try {
    const {
      sortBy, sortDir, limit, offset, search,
      country, vacBanned, gameBanned, tradeBanned,
      hasCyrillic, personaState, visibilityState,
      minFriends, maxFriends,
    } = req.query;

    const out = await service.list({
      sortBy,
      sortDir,
      limit,
      offset,
      search: search || '',
      filters: {
        country: country || undefined,
        vacBanned: vacBanned === 'true' ? true : vacBanned === 'false' ? false : undefined,
        gameBanned: gameBanned === 'true' ? true : gameBanned === 'false' ? false : undefined,
        tradeBanned: tradeBanned === 'true' ? true : tradeBanned === 'false' ? false : undefined,
        hasCyrillic: hasCyrillic === 'true' ? true : hasCyrillic === 'false' ? false : undefined,
        personaState: personaState != null && personaState !== '' ? Number(personaState) : undefined,
        visibilityState: visibilityState != null && visibilityState !== '' ? Number(visibilityState) : undefined,
        minFriends: minFriends != null && minFriends !== '' ? Number(minFriends) : undefined,
        maxFriends: maxFriends != null && maxFriends !== '' ? Number(maxFriends) : undefined,
      },
    });
    res.json(out);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const row = await service.getLocal(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  } catch (err) { next(err); }
};

const fetchOne = async (req, res, next) => {
  try {
    const force = req.query.force === 'true';
    const { profile, fromCache, error } = await service.getOrFetch(req.params.id, { force });
    if (error) {
      const status = error === 'invalid-identifier' ? 400 : 404;
      return res.status(status).json({ error });
    }
    res.json({ profile, fromCache });
  } catch (err) {
    logger.error(`fetchOne failed: ${err.message}`);
    next(err);
  }
};

const deleteOne = async (req, res, next) => {
  try {
    const n = await service.remove(req.params.id);
    res.json({ deleted: n });
  } catch (err) { next(err); }
};

const deleteAll = async (_req, res, next) => {
  try {
    const n = await service.removeAll();
    res.json({ deleted: n });
  } catch (err) { next(err); }
};

const inventoryErrors = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.steamIds) ? req.body.steamIds : [];
    const rows = await service.withInventoryErrors(ids);
    res.json({ profiles: rows });
  } catch (err) { next(err); }
};

const fetchAllStart = async (req, res, next) => {
  try {
    const out = await bulkAll.start({
      concurrency: req.body?.concurrency,
      includeCs2: req.body?.includeCs2 !== false,
      force: req.body?.force === true,
    });
    res.status(202).json(out);
  } catch (err) { next(err); }
};

const fetchAllStatus = async (_req, res, next) => {
  try { res.json(bulkAll.get()); } catch (err) { next(err); }
};

const fetchAllCancel = async (_req, res, next) => {
  try { res.json(bulkAll.cancel()); } catch (err) { next(err); }
};

module.exports = {
  list, getOne, fetchOne, deleteOne, deleteAll, inventoryErrors,
  fetchAllStart, fetchAllStatus, fetchAllCancel,
};
