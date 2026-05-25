'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CS2Inventory extends Model {
    static associate(models) {
      CS2Inventory.belongsTo(models.Profile, {
        foreignKey: 'profileId',
        targetKey: 'steamId',
        as: 'profile',
      });
    }
  }

  CS2Inventory.init(
    {
      profileId: { type: DataTypes.STRING(17), allowNull: false, primaryKey: true, field: 'profile_id' },
      totalValueUsd: { type: DataTypes.DECIMAL(12, 2), field: 'total_value_usd' },
      totalValueWithStickersUsd: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'total_value_with_stickers_usd' },
      tradableItemsCount: { type: DataTypes.INTEGER, defaultValue: 0, field: 'tradable_items_count' },
      totalItemsCount: { type: DataTypes.INTEGER, defaultValue: 0, field: 'total_items_count' },
      top5TradableItems: { type: DataTypes.JSON, field: 'top_5_tradable_items' },
      items: { type: DataTypes.JSON, allowNull: true },
      medals: { type: DataTypes.JSON, allowNull: true },
      notableItems: { type: DataTypes.JSON, allowNull: true, field: 'notable_items' },
      status: {
        type: DataTypes.ENUM('checked', 'private', 'empty', 'error', 'skipped'),
        allowNull: false,
      },
      skipReason: { type: DataTypes.STRING, field: 'skip_reason' },
      lastChecked: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'last_checked' },
      has2025ServiceMedal: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'has_2025_service_medal' },
      hasPremierSeasonOneMedal: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'has_premier_season_one_medal' },
      hasPremierSeasonTwoMedal: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'has_premier_season_two_medal' },
      processingTimeMs: { type: DataTypes.INTEGER, allowNull: true, field: 'processing_time_ms' },
    },
    {
      sequelize,
      modelName: 'CS2Inventory',
      tableName: 'cs2_inventories',
      timestamps: false,
    }
  );

  return CS2Inventory;
};
