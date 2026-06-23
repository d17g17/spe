'use strict';

module.exports = {
  async up({ context: q }) {
    const { Sequelize } = require('sequelize');
    const tables = await q.showAllTables();
    if (!tables.includes('breach_cache')) {
      await q.createTable('breach_cache', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        profile_id: { type: Sequelize.STRING(32), allowNull: false },
        source: { type: Sequelize.STRING(255), allowNull: false },
        row_hash: { type: Sequelize.STRING(64), allowNull: false },
        row_json: { type: Sequelize.TEXT, allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
      await q.addIndex('breach_cache', ['profile_id']);
      await q.addIndex('breach_cache', ['profile_id', 'row_hash'], { unique: true });
    }
  },
  async down({ context: q }) {
    try { await q.dropTable('breach_cache'); } catch (_) { /* ignore */ }
  },
};
