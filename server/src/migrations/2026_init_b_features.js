'use strict';

module.exports = {
  async up({ context: q }) {
    const { Sequelize } = require('sequelize');
    const desc = await q.describeTable('cs2_inventories');
    if (!desc.items) {
      await q.addColumn('cs2_inventories', 'items', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
    const priceDesc = await q.describeTable('item_prices');
    if (!priceDesc.volume) {
      await q.addColumn('item_prices', 'volume', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      });
    }
  },
  async down({ context: q }) {
    try { await q.removeColumn('cs2_inventories', 'items'); } catch (_) { /* ignore */ }
    try { await q.removeColumn('item_prices', 'volume'); } catch (_) { /* ignore */ }
  },
};
