const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const logger = require('./utils/logger');
const { globSync } = require('glob');

// Load Sequelize models and instance
const { sequelize } = require('./models');

const dbPath = process.env.DB_PATH || './database/steamprofiles.db';

/**
 * Ensures the database directory exists and creates it if it doesn't.
 */
const ensureDatabaseExists = async () => {
  const dbDir = path.dirname(dbPath);
  
  logger.info('DB Init', `Checking if database directory exists: ${dbDir}`);
  
  // Create database directory if it doesn't exist
  if (!fs.existsSync(dbDir)) {
    logger.info('DB Init', `Database directory does not exist. Creating: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
    logger.success('DB Init', `Database directory created successfully.`);
  } else {
    logger.info('DB Init', `Database directory already exists.`);
  }
  
  // Check if database file exists
  if (fs.existsSync(dbPath)) {
    logger.info('DB Init', `SQLite database file already exists: ${dbPath}`);
  } else {
    logger.info('DB Init', `SQLite database file will be created: ${dbPath}`);
  }
};

/**
 * Runs pending Sequelize migrations programmatically using Umzug.
 */
const runMigrations = async () => {
  logger.info('DB Init', 'Configuring migrations (Umzug)...');
  const migrationsPath = path.join(__dirname, 'migrations');
  // Ensure backslashes are used for glob pattern on Windows if needed by the glob package
  const migrationsGlob = path.join(migrationsPath, '*.js').replace(/\\/g, '/'); // Normalize slashes for glob

  logger.info('DB Init', `Using migrations path: ${migrationsPath}`);
  logger.info('DB Init', `Using migrations glob: ${migrationsGlob}`);

  const umzug = new Umzug({
    migrations: {
      glob: migrationsGlob, // Use the same pattern
      resolve: ({ name, path: migrationFilePath, context }) => {
        logger.debug('DB Init', `Resolving migration: ${name} from ${migrationFilePath}`);
        const migration = require(migrationFilePath);
        return {
          name,
          up: async () => migration.up(context, Sequelize),
          down: async () => migration.down(context, Sequelize),
        };
      }
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });

  try {
    logger.info('DB Init', 'Checking pending migrations with umzug.pending()...');
    const pendingMigrations = await umzug.pending();
    logger.info('DB Init', 'Pending migrations found by Umzug:', pendingMigrations.map(m => m.name));

    logger.info('DB Init', 'Running umzug.up()...');
    const executedMigrations = await umzug.up();
    if (executedMigrations.length > 0) {
      logger.success('DB Init', 'Migrations executed successfully by Umzug:', executedMigrations.map(m => m.name));
    } else {
      logger.info('DB Init', 'No migrations were executed by umzug.up().');
    }
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error; // Re-throw to prevent application startup
  }
};

/**
 * Initializes the database: ensures it exists and runs migrations.
 */
const initializeDatabase = async () => {
  logger.info('DB Init', 'Starting database initialization process...');
  await ensureDatabaseExists();
  await runMigrations();
  logger.success('DB Init', 'Database initialization process finished.');
};

module.exports = { initializeDatabase };