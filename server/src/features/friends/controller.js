'use strict';

const repo = require('./repo');
const pipeline = require('./pipeline');

const list = async (req, res, next) => {
  try {
    const { limit, offset } = req.query;
    const [friends, total] = await Promise.all([
      repo.listFriends(req.params.id, { limit, offset }),
      repo.countFriends(req.params.id),
    ]);
    res.json({ friends, total });
  } catch (err) { next(err); }
};

const fetch = async (req, res, next) => {
  try {
    const state = await pipeline.start(req.params.id);
    res.json(state);
  } catch (err) { next(err); }
};

const status = async (req, res, next) => {
  try {
    res.json(pipeline.getStatus(req.params.id));
  } catch (err) { next(err); }
};

const activeAll = async (_req, res, next) => {
  try {
    res.json(pipeline.listActive());
  } catch (err) { next(err); }
};

module.exports = { list, fetch, status, activeAll };
