'use strict';

const pLimitImport = import('p-limit');
const config = require('../config');

let steamLimit = null;
let inventoryLimit = null;

const ensure = async () => {
  const { default: pLimit } = await pLimitImport;
  if (!steamLimit) steamLimit = pLimit(config.steamConcurrency);
  if (!inventoryLimit) inventoryLimit = pLimit(config.inventoryConcurrency);
};

const steam = async (fn) => {
  await ensure();
  return steamLimit(fn);
};

const inventory = async (fn) => {
  await ensure();
  return inventoryLimit(fn);
};

module.exports = { steam, inventory };
