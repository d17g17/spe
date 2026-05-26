'use strict';

module.exports = {
  async up({ context: q }) {
    const { Sequelize } = require('sequelize');
    const desc = await q.describeTable('Profiles');
    if (!desc.gc_nickname) {
      await q.addColumn('Profiles', 'gc_nickname', {
        type: Sequelize.STRING(128),
        allowNull: true,
      });
    }
    if (!desc.gc_player_id) {
      await q.addColumn('Profiles', 'gc_player_id', {
        type: Sequelize.STRING(32),
        allowNull: true,
      });
    }
    if (!desc.gc_checked) {
      await q.addColumn('Profiles', 'gc_checked', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },
  async down({ context: q }) {
    try { await q.removeColumn('Profiles', 'gc_nickname'); } catch (_) { /* ignore */ }
    try { await q.removeColumn('Profiles', 'gc_player_id'); } catch (_) { /* ignore */ }
    try { await q.removeColumn('Profiles', 'gc_checked'); } catch (_) { /* ignore */ }
  },
};
