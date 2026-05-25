'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Friendship extends Model {
    static associate(models) {
      // Define association with Profile model
      Friendship.belongsTo(models.Profile, {
        foreignKey: 'profileSteamId',
        as: 'profile'
      });

      Friendship.belongsTo(models.Profile, {
        foreignKey: 'friendSteamId',
        as: 'friend'
      });
    }
  }

  Friendship.init({
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    profileSteamId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'Profiles',
        key: 'steamId'
      }
    },
    friendSteamId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'Profiles',
        key: 'steamId'
      }
    },
    friendSince: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Friendship',
    indexes: [
      {
        unique: true,
        fields: ['profileSteamId', 'friendSteamId']
      }
    ]
  });
  
  return Friendship;
};
