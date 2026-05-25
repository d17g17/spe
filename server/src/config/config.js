// Environment variables are loaded in server.js

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: process.env.DB_PATH || './database/steamprofiles.db',
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      // Enable foreign key constraints
      foreignKeys: true
    }
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:', // Use in-memory database for tests
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      foreignKeys: true
    }
  },
  production: {
    dialect: 'sqlite',
    storage: process.env.DB_PATH || './database/steamprofiles.db',
    logging: false,
    pool: {
      max: 30,
      min: 10,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      foreignKeys: true,
      // Enable WAL mode for better concurrent access
      pragma: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        cache_size: -64000, // 64MB cache
        temp_store: 'MEMORY'
      }
    }
  }
};