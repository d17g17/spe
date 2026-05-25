'use strict';

module.exports = {
  async up({ context: q }) {
    const { Sequelize } = require('sequelize');
    const desc = await q.describeTable('cs2_inventories');
    if (!desc.notable_items) {
      await q.addColumn('cs2_inventories', 'notable_items', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
  },
  async down({ context: q }) {
    try { await q.removeColumn('cs2_inventories', 'notable_items'); } catch (_) { /* ignore */ }
  },
};
