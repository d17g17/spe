'use strict';

const service = require('./service');
const socketBus = require('../../socket');

const get = async (req, res, next) => {
  try {
    const row = await service.getStored(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  } catch (err) { next(err); }
};

const fetch = async (req, res, next) => {
  try {
    const row = await service.fetchAndStore(req.params.id);
    socketBus.emit('inventory:update', { steamId: req.params.id, inventory: row });
    res.json(row);
  } catch (err) { next(err); }
};

const stats = async (_req, res, next) => {
  try { res.json(await service.stats()); } catch (err) { next(err); }
};

module.exports = { get, fetch, stats };
