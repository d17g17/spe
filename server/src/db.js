'use strict';

const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const config = require('./config');
const logger = require('./utils/logger');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: config.dbPath,
  logging: false,
});

const modelFactories = {
  Profile: require('./models/profile'),
  Friendship: require('./models/friendship'),
  CS2Inventory: require('./models/cs2Inventory'),
  ItemPrice: require('./models/itemPrice'),
};

const models = {};
for (const [name, factory] of Object.entries(modelFactories)) {
  models[name] = factory(sequelize, DataTypes);
}
for (const model of Object.values(models)) {
  if (typeof model.associate === 'function') model.associate(models);
}

const umzug = new Umzug({
  migrations: {
    glob: ['*.js', { cwd: path.join(__dirname, 'migrations') }],
    resolve: ({ name, path: filePath, context }) => {
      const mod = require(filePath);
      return {
        name,
        up: async () => mod.up({ context }),
        down: async () => mod.down({ context }),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: undefined,
});

const initializeDatabase = async () => {
  const pending = await umzug.pending();
  if (pending.length > 0) {
    logger.info(`Running ${pending.length} pending migration(s)`);
    await umzug.up();
  }
};

module.exports = { sequelize, models, initializeDatabase };
