'use strict';
const { DataTypes } = require('sequelize');

module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.addColumn('Profiles', 'isStarred', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('Profiles', 'starNote', {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  },
  down: async ({ context: queryInterface }) => {
    await queryInterface.removeColumn('Profiles', 'isStarred');
    await queryInterface.removeColumn('Profiles', 'starNote');
  },
};
