'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Friendship extends Model {
    static associate(models) {
      Friendship.belongsTo(models.Profile, { foreignKey: 'profileSteamId', as: 'profile' });
      Friendship.belongsTo(models.Profile, { foreignKey: 'friendSteamId', as: 'friend' });
    }
  }

  Friendship.init(
    {
      id: { type: DataTypes.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      profileSteamId: {
        type: DataTypes.STRING(17),
        allowNull: false,
        references: { model: 'Profiles', key: 'steamId' },
      },
      friendSteamId: {
        type: DataTypes.STRING(17),
        allowNull: false,
        references: { model: 'Profiles', key: 'steamId' },
      },
      friendSince: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Friendship',
      indexes: [{ unique: true, fields: ['profileSteamId', 'friendSteamId'] }],
    }
  );

  return Friendship;
};
