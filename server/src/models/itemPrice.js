"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ItemPrice extends Model {
    /**
     * Define associations here if needed in the future
     */
    static associate(models) {
      // No associations for now
    }
  }

  ItemPrice.init(
    {
      itemIdentifier: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: true,
        field: "item_identifier",
      },
      priceUsd: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: "price_usd",
      },
      lastUpdated: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "last_updated",
      },
      isCase: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_case",
        comment: "Whether this item is a case (affects cache expiry)",
      },
      fetchCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: "fetch_count",
        comment: "Number of times this price has been fetched",
      },
    },
    {
      sequelize,
      modelName: "ItemPrice",
      tableName: "item_prices",
      timestamps: false,
    }
  );

  return ItemPrice;
};
