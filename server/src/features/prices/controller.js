'use strict';

const service = require('./service');

const exportAll = async (_req, res, next) => {
  try {
    const rows = await service.listAll();
    res.json({ prices: rows });
  } catch (err) { next(err); }
};

const importMany = async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.prices) ? req.body.prices : req.body;
    const out = await service.importMany(items);
    res.json(out);
  } catch (err) { next(err); }
};

const clear = async (_req, res, next) => {
  try {
    res.json(await service.clearAll());
  } catch (err) { next(err); }
};

const stats = async (_req, res, next) => {
  try {
    res.json(await service.stats());
  } catch (err) { next(err); }
};

module.exports = { exportAll, importMany, clear, stats };
