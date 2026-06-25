'use strict';

const crawler = require('./crawler');

const startCrawl = async (req, res, next) => {
  try {
    const { steamId, options } = req.body;
    if (!steamId) return res.status(400).json({ error: 'steamId is required' });
    const state = await crawler.start(steamId, options || {});
    res.json(state);
  } catch (err) { next(err); }
};

const getStatus = async (req, res, next) => {
  try {
    const { steamId } = req.params;
    res.json(crawler.getStatus(steamId));
  } catch (err) { next(err); }
};

const activeAll = async (req, res, next) => {
  try {
    res.json(crawler.listActive());
  } catch (err) { next(err); }
};
const cancelCrawl = async (req, res, next) => {
  try {
    const result = crawler.cancel(req.params.steamId);
    res.json(result);
  } catch (err) { next(err); }
};

module.exports = { startCrawl, getStatus, activeAll, cancelCrawl };
