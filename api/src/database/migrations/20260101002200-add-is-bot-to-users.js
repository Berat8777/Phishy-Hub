'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Marks the fixed `@ai` bot user (see utils/constants.ts::AI_BOT_USER_ID)
    // so it can be excluded from login and admin user management (Module 7).
    await queryInterface.addColumn('users', 'is_bot', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'is_bot');
  },
};
