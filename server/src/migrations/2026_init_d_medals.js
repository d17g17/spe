'use strict';

module.exports = {
  async up({ context: q }) {
    const { Sequelize } = require('sequelize');
    const desc = await q.describeTable('cs2_inventories');
    if (!desc.medals) {
      await q.addColumn('cs2_inventories', 'medals', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
  },
  async down({ context: q }) {
    try { await q.removeColumn('cs2_inventories', 'medals'); } catch (_) { /* ignore */ }
  },
};
