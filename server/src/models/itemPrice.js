'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ItemPrice extends Model {
    static associate() {}
  }

  ItemPrice.init(
    {
      itemIdentifier: { type: DataTypes.STRING(255), allowNull: false, primaryKey: true, field: 'item_identifier' },
      priceUsd: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'price_usd' },
      lastUpdated: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'last_updated' },
      isCase: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_case' },
      fetchCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'fetch_count' },
    },
    {
      sequelize,
      modelName: 'ItemPrice',
      tableName: 'item_prices',
      timestamps: false,
    }
  );

  return ItemPrice;
};
