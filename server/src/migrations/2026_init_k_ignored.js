'use strict';

module.exports = {
  async up({ context: q }) {
    const { Sequelize } = require('sequelize');
    const desc = await q.describeTable('Profiles');
    if (!desc.ignored) {
      await q.addColumn('Profiles', 'ignored', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },
  async down({ context: q }) {
    try { await q.removeColumn('Profiles', 'ignored'); } catch (_) { /* ignore */ }
  },
};
