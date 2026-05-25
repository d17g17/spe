'use strict';

module.exports = {
  async up({ context: q }) {
    const { Sequelize } = require('sequelize');

    await q.createTable('Profiles', {
      steamId: { type: Sequelize.STRING(17), allowNull: false, primaryKey: true },
      name: { type: Sequelize.STRING(64), allowNull: true },
      realName: { type: Sequelize.STRING(128), allowNull: true },
      avatarUrl: { type: Sequelize.STRING(512), allowNull: true },
      profileUrl: { type: Sequelize.STRING(512), allowNull: true },
      country: { type: Sequelize.STRING(2), allowNull: true },
      locStateCode: { type: Sequelize.STRING(8), allowNull: true },
      locCityId: { type: Sequelize.INTEGER, allowNull: true },
      hasCyrillic: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      lastPlayedGame: { type: Sequelize.STRING(128), allowNull: true },
      communityVisibilityState: { type: Sequelize.INTEGER, allowNull: true },
      profileState: { type: Sequelize.INTEGER, allowNull: true },
      personaState: { type: Sequelize.INTEGER, allowNull: true },
      lastLogoff: { type: Sequelize.DATE, allowNull: true },
      friendsCount: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      playtime2Weeks: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      lastBadgeDate: { type: Sequelize.DATE, allowNull: true },
      vacBanned: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      gameBanned: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      tradeBanned: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await q.createTable('Friendships', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      profileSteamId: {
        type: Sequelize.STRING(17),
        allowNull: false,
        references: { model: 'Profiles', key: 'steamId' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      friendSteamId: {
        type: Sequelize.STRING(17),
        allowNull: false,
        references: { model: 'Profiles', key: 'steamId' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      friendSince: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await q.createTable('cs2_inventories', {
      profile_id: {
        type: Sequelize.STRING(17),
        allowNull: false,
        primaryKey: true,
        references: { model: 'Profiles', key: 'steamId' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      total_value_usd: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      tradable_items_count: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      total_items_count: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      top_5_tradable_items: { type: Sequelize.JSON, allowNull: true },
      status: { type: Sequelize.ENUM('checked', 'private', 'empty', 'error', 'skipped'), allowNull: false },
      skip_reason: { type: Sequelize.STRING(255), allowNull: true },
      last_checked: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      has_2025_service_medal: { type: Sequelize.BOOLEAN, defaultValue: false },
      has_premier_season_one_medal: { type: Sequelize.BOOLEAN, defaultValue: false },
      has_premier_season_two_medal: { type: Sequelize.BOOLEAN, defaultValue: false },
      processing_time_ms: { type: Sequelize.INTEGER, allowNull: true },
    });

    await q.createTable('item_prices', {
      item_identifier: { type: Sequelize.STRING(255), allowNull: false, primaryKey: true },
      price_usd: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      last_updated: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      is_case: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      fetch_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
    });

    await q.addIndex('Profiles', ['country'], { name: 'idx_profiles_country' });
    await q.addIndex('Profiles', ['personaState'], { name: 'idx_profiles_persona_state' });
    await q.addIndex('Profiles', ['lastLogoff'], { name: 'idx_profiles_last_logoff' });
    await q.addIndex('Profiles', ['friendsCount'], { name: 'idx_profiles_friends_count' });
    await q.addIndex('Profiles', ['playtime2Weeks'], { name: 'idx_profiles_playtime_2weeks' });
    await q.addIndex('Profiles', ['vacBanned', 'gameBanned', 'tradeBanned'], { name: 'idx_profiles_ban_status' });
    await q.addIndex('Profiles', ['communityVisibilityState'], { name: 'idx_profiles_visibility_state' });
    await q.addIndex('Profiles', ['updatedAt'], { name: 'idx_profiles_updated_at' });

    await q.addIndex('Friendships', ['profileSteamId', 'friendSteamId'], {
      unique: true,
      name: 'friendships_unique_relationship',
    });
    await q.addIndex('Friendships', ['friendSteamId'], { name: 'idx_friendships_friend_steam_id' });

    await q.addIndex('item_prices', ['last_updated'], { name: 'idx_item_prices_last_updated' });
    await q.addIndex('item_prices', ['is_case', 'last_updated'], { name: 'idx_item_prices_case_expiry' });
    await q.addIndex('item_prices', ['price_usd'], { name: 'idx_item_prices_value' });

    await q.addIndex('cs2_inventories', ['status'], { name: 'idx_cs2_inventories_status' });
    await q.addIndex('cs2_inventories', ['total_value_usd'], { name: 'idx_cs2_inventories_value' });
    await q.addIndex('cs2_inventories', ['last_checked'], { name: 'idx_cs2_inventories_last_checked' });
  },

  async down({ context: q }) {
    await q.dropTable('cs2_inventories');
    await q.dropTable('item_prices');
    await q.dropTable('Friendships');
    await q.dropTable('Profiles');
  },
};
