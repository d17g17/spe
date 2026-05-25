'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
// Determine environment (development, test, production)
const env = process.env.NODE_ENV || 'development';
// Construct the full path to the config file
const configPath = path.join(__dirname, '..', 'config', 'config.js');
// Check if config file exists
if (!fs.existsSync(configPath)) {
  const logger = require('../utils/logger');
  logger.error('Models', `Sequelize config file not found at ${configPath}`);
  process.exit(1);
}
const config = require(configPath)[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  // If using an environment variable for the connection string (e.g., DATABASE_URL)
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  // Otherwise, use individual database credentials from config
  // Create custom logging function to filter out inventory-related queries
  const customLogging = (sql, timing) => {
    // Skip logging for item_prices and cs2_inventories queries to reduce verbosity
    if (sql.includes('item_prices') || sql.includes('cs2_inventories')) {
      // Only log if it's not a SELECT query (to reduce noise)
      if (!sql.toLowerCase().startsWith('select')) {
        const logger = require('../utils/logger');
        logger.debug('SQL', `${sql.substring(0, 60)}... [${timing}ms]`);
      }
      return;
    }
    // For all other queries, use default logging
    if (config.logging !== false) {
      const logger = require('../utils/logger');
      logger.db('SQL', sql.substring(0, 100) + (sql.length > 100 ? '...' : ''));
    }
  };
  
  // Apply custom logging to config
  const sequelizeConfig = {
    ...config,
    logging: customLogging
  };
  
  sequelize = new Sequelize(config.database, config.username, config.password, sequelizeConfig);
}

// Find all model files in the current directory (excluding index.js)
fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    // Require the model file and initialize it with the sequelize instance and DataTypes
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    // Add the initialized model to the db object
    db[model.name] = model;
  });

// Run associate methods if they exist on the models
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Export the sequelize instance and the db object containing models
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;