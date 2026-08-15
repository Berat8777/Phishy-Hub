'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint('users', {
      fields: ['avatar_file_id'],
      type: 'foreign key',
      name: 'users_avatar_file_id_fkey',
      references: { table: 'files', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('users', 'users_avatar_file_id_fkey');
  },
};
