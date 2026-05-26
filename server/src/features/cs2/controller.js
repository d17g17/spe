'use strict';

const service = require('./service');
const bulk = require('./bulkPipeline');
const backfill = require('./backfill');
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

const bulkStart = async (req, res, next) => {
  try {
    const force = req.query?.force === 'true' || req.body?.force === true;
    const concurrency = req.body?.concurrency != null ? Number(req.body.concurrency) : undefined;
    const adaptive = req.body?.adaptive === true;
    const { sortBy, sortDir, filters, search } = req.body || {};
    const state = await bulk.start(req.params.id, {
      force, concurrency, adaptive, sortBy, sortDir, filters, search,
    });
    res.json(state);
  } catch (err) { next(err); }
};

const bulkStatus = async (req, res, next) => {
  try { res.json(bulk.getStatus(req.params.id)); } catch (err) { next(err); }
};

const bulkActive = async (_req, res, next) => {
  try { res.json(bulk.listActive()); } catch (err) { next(err); }
};

const backfillMedals = async (_req, res, next) => {
  try {
    const result = await backfill.backfillMedalsFromItems();
    res.json(result);
  } catch (err) { next(err); }
};

const backfillRareTags = async (_req, res, next) => {
  try {
    const result = await backfill.backfillRareTagsFromItems();
    res.json(result);
  } catch (err) { next(err); }
};

module.exports = { get, fetch, stats, bulkStart, bulkStatus, bulkActive, backfillMedals, backfillRareTags };
