'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Profile extends Model {
    static associate(models) {
      Profile.hasMany(models.Friendship, { foreignKey: 'profileSteamId', as: 'friendships' });
      Profile.belongsToMany(models.Profile, {
        through: models.Friendship,
        foreignKey: 'profileSteamId',
        otherKey: 'friendSteamId',
        as: 'friends',
      });
      Profile.hasOne(models.CS2Inventory, {
        foreignKey: 'profileId',
        sourceKey: 'steamId',
        as: 'cs2Inventory',
      });
    }
  }

  Profile.init(
    {
      steamId: { type: DataTypes.STRING(17), allowNull: false, primaryKey: true },
      name: { type: DataTypes.STRING(64), allowNull: true },
      realName: { type: DataTypes.STRING(128), allowNull: true },
      avatarUrl: { type: DataTypes.STRING(512), allowNull: true },
      profileUrl: { type: DataTypes.STRING(512), allowNull: true },
      country: { type: DataTypes.STRING(2), allowNull: true },
      locStateCode: { type: DataTypes.STRING(8), allowNull: true },
      locCityId: { type: DataTypes.INTEGER, allowNull: true },
      hasCyrillic: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      lastPlayedGame: { type: DataTypes.STRING(128), allowNull: true },
      communityVisibilityState: { type: DataTypes.INTEGER, allowNull: true },
      profileState: { type: DataTypes.INTEGER, allowNull: true },
      personaState: { type: DataTypes.INTEGER, allowNull: true },
      lastLogoff: { type: DataTypes.DATE, allowNull: true },
      friendsCount: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      playtime2Weeks: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      lastBadgeDate: { type: DataTypes.DATE, allowNull: true },
      badges: { type: DataTypes.JSON, allowNull: true },
      vacBanned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      gameBanned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      tradeBanned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { sequelize, modelName: 'Profile' }
  );

  return Profile;
};
