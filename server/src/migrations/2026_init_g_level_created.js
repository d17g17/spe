'use strict';

module.exports = {
  async up({ context: q }) {
    const { Sequelize } = require('sequelize');
    const desc = await q.describeTable('Profiles');
    if (!desc.steam_level) {
      await q.addColumn('Profiles', 'steam_level', { type: Sequelize.INTEGER, allowNull: true });
    }
    if (!desc.time_created) {
      await q.addColumn('Profiles', 'time_created', { type: Sequelize.DATE, allowNull: true });
    }
  },
  async down({ context: q }) {
    try { await q.removeColumn('Profiles', 'steam_level'); } catch (_) { /* ignore */ }
    try { await q.removeColumn('Profiles', 'time_created'); } catch (_) { /* ignore */ }
  },
};
