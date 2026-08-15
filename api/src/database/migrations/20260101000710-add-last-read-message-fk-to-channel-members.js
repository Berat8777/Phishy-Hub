'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint('channel_members', {
      fields: ['last_read_message_id'],
      type: 'foreign key',
      name: 'channel_members_last_read_message_id_fkey',
      references: { table: 'messages', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('channel_members', 'channel_members_last_read_message_id_fkey');
  },
};
