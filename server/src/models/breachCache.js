'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class BreachCache extends Model {
    static associate() {}
  }

  BreachCache.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      profileId: { type: DataTypes.STRING(32), allowNull: false, field: 'profile_id' },
      source: { type: DataTypes.STRING(255), allowNull: false },
      rowHash: { type: DataTypes.STRING(64), allowNull: false, field: 'row_hash' },
      rowJson: { type: DataTypes.TEXT, allowNull: false, field: 'row_json' },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
    },
    {
      sequelize,
      modelName: 'BreachCache',
      tableName: 'breach_cache',
      timestamps: false,
      indexes: [
        { fields: ['profile_id'] },
        { unique: true, fields: ['profile_id', 'row_hash'] },
      ],
    }
  );

  return BreachCache;
};
