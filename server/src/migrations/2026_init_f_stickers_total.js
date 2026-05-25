'use strict';

module.exports = {
  async up({ context: q }) {
    const { Sequelize } = require('sequelize');
    const desc = await q.describeTable('cs2_inventories');
    if (!desc.total_value_with_stickers_usd) {
      await q.addColumn('cs2_inventories', 'total_value_with_stickers_usd', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      });
    }
  },
  async down({ context: q }) {
    try { await q.removeColumn('cs2_inventories', 'total_value_with_stickers_usd'); } catch (_) { /* ignore */ }
  },
};
