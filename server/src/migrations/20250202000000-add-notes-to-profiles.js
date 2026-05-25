'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Profiles', 'notes', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Notes about the profile, including items not found on Steam market'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Profiles', 'notes');
  },
};