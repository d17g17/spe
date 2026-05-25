'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Profile extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Define friendship associations
      Profile.hasMany(models.Friendship, {
        foreignKey: 'profileSteamId',
        as: 'friendships'
      });

      // Self-referential many-to-many relationship through Friendships
      Profile.belongsToMany(models.Profile, {
        through: models.Friendship,
        foreignKey: 'profileSteamId',
        otherKey: 'friendSteamId',
        as: 'friends'
      });
      
      // Association with CS2Inventory
      Profile.hasOne(models.CS2Inventory, {
        foreignKey: 'profileId',
        sourceKey: 'steamId',
        as: 'cs2Inventory'
      });
    }
  }
  Profile.init({
    // Using steamId (string) as primary key, matching Steam's 64-bit ID format
    steamId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true, // Name might not always be available or could be empty
    },
    realName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    avatarUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    profileUrl: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    country: {
      type: DataTypes.STRING(2), // ISO 3166-1 alpha-2 country codes are 2 chars
      allowNull: true,
    },
    // Store state/city if needed, though they might be less reliable/useful
    locStateCode: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    locCityId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    hasCyrillic: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
    },
    lastPlayedGame: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    communityVisibilityState: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    profileState: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    personaState: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    lastLogoff: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    friendsCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    playtime2Weeks: {
      type: DataTypes.INTEGER, // In minutes
      allowNull: true,
    },
    lastBadgeDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    vacBanned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    gameBanned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    tradeBanned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Timestamps are handled automatically by Sequelize (createdAt, updatedAt)
  }, {
    sequelize,
    modelName: 'Profile',
    // Optional: Define table name explicitly if different from plural model name
    // tableName: 'profiles'
  });
  return Profile;
};