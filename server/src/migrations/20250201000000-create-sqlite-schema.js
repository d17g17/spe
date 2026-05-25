'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create Profiles table with optimized SQLite schema
    await queryInterface.createTable('Profiles', {
      steamId: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING(17), // Steam IDs are exactly 17 characters
      },
      name: {
        type: Sequelize.STRING(32), // Steam display names max 32 chars
        allowNull: true,
      },
      realName: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      avatarUrl: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      profileUrl: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING(2),
        allowNull: true,
      },
      locStateCode: {
        type: Sequelize.STRING(8),
        allowNull: true,
      },
      locCityId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      hasCyrillic: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      lastPlayedGame: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      communityVisibilityState: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      profileState: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      personaState: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      lastLogoff: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      friendsCount: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      playtime2Weeks: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      lastBadgeDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      vacBanned: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      gameBanned: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      tradeBanned: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Create Friendships table
    await queryInterface.createTable('Friendships', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      profileSteamId: {
        type: Sequelize.STRING(17),
        allowNull: false,
        references: {
          model: 'Profiles',
          key: 'steamId',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      friendSteamId: {
        type: Sequelize.STRING(17),
        allowNull: false,
        references: {
          model: 'Profiles',
          key: 'steamId',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      friendSince: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Create item_prices table with improved structure
    await queryInterface.createTable('item_prices', {
      item_identifier: {
        type: Sequelize.STRING(255),
        allowNull: false,
        primaryKey: true,
      },
      price_usd: {
        type: Sequelize.DECIMAL(10, 2), // Better precision for currency
        allowNull: false,
        defaultValue: 0.00,
      },
      last_updated: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      is_case: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this item is a case (affects cache expiry)',
      },
      fetch_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Number of times this price has been fetched',
      },
    });

    // Create cs2_inventories table with enhanced structure
    await queryInterface.createTable('cs2_inventories', {
      profile_id: {
        type: Sequelize.STRING(17),
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'Profiles',
          key: 'steamId',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      total_value_usd: {
        type: Sequelize.DECIMAL(12, 2), // Support higher inventory values
        allowNull: true,
      },
      tradable_items_count: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      total_items_count: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: 'Total items including non-tradable',
      },
      top_5_tradable_items: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('checked', 'private', 'empty', 'error', 'skipped'),
        allowNull: false,
      },
      skip_reason: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      last_checked: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      has_2025_service_medal: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      has_premier_season_one_medal: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      has_premier_season_two_medal: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      processing_time_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Time taken to process inventory in milliseconds',
      },
    });

    // Create optimized indexes for SQLite
    
    // Profiles indexes
    await queryInterface.addIndex('Profiles', ['country'], {
      name: 'idx_profiles_country',
    });
    await queryInterface.addIndex('Profiles', ['personaState'], {
      name: 'idx_profiles_persona_state',
    });
    await queryInterface.addIndex('Profiles', ['lastLogoff'], {
      name: 'idx_profiles_last_logoff',
    });
    await queryInterface.addIndex('Profiles', ['friendsCount'], {
      name: 'idx_profiles_friends_count',
    });
    await queryInterface.addIndex('Profiles', ['playtime2Weeks'], {
      name: 'idx_profiles_playtime_2weeks',
    });
    await queryInterface.addIndex('Profiles', ['vacBanned', 'gameBanned', 'tradeBanned'], {
      name: 'idx_profiles_ban_status',
    });
    await queryInterface.addIndex('Profiles', ['communityVisibilityState'], {
      name: 'idx_profiles_visibility_state',
    });
    await queryInterface.addIndex('Profiles', ['updatedAt'], {
      name: 'idx_profiles_updated_at',
    });

    // Friendships indexes
    await queryInterface.addIndex('Friendships', ['profileSteamId', 'friendSteamId'], {
      unique: true,
      name: 'friendships_unique_relationship',
    });
    await queryInterface.addIndex('Friendships', ['friendSteamId'], {
      name: 'idx_friendships_friend_steam_id',
    });

    // Item prices indexes
    await queryInterface.addIndex('item_prices', ['last_updated'], {
      name: 'idx_item_prices_last_updated',
    });
    await queryInterface.addIndex('item_prices', ['is_case', 'last_updated'], {
      name: 'idx_item_prices_case_expiry',
    });
    await queryInterface.addIndex('item_prices', ['price_usd'], {
      name: 'idx_item_prices_value',
    });

    // CS2 inventories indexes
    await queryInterface.addIndex('cs2_inventories', ['status'], {
      name: 'idx_cs2_inventories_status',
    });
    await queryInterface.addIndex('cs2_inventories', ['total_value_usd'], {
      name: 'idx_cs2_inventories_value',
    });
    await queryInterface.addIndex('cs2_inventories', ['last_checked'], {
      name: 'idx_cs2_inventories_last_checked',
    });
    await queryInterface.addIndex('cs2_inventories', ['has_2025_service_medal'], {
      name: 'idx_cs2_inventories_2025_medal',
    });
    await queryInterface.addIndex('cs2_inventories', ['has_premier_season_one_medal'], {
      name: 'idx_cs2_inventories_premier_s1',
    });
    await queryInterface.addIndex('cs2_inventories', ['has_premier_season_two_medal'], {
      name: 'idx_cs2_inventories_premier_s2',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('cs2_inventories');
    await queryInterface.dropTable('item_prices');
    await queryInterface.dropTable('Friendships');
    await queryInterface.dropTable('Profiles');
  },
};