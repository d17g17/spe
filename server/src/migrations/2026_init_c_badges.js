'use strict';

module.exports = {
  async up({ context: q }) {
    const { Sequelize } = require('sequelize');
    const desc = await q.describeTable('Profiles');
    if (!desc.badges) {
      await q.addColumn('Profiles', 'badges', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
  },
  async down({ context: q }) {
    try { await q.removeColumn('Profiles', 'badges'); } catch (_) { /* ignore */ }
  },
};
