'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('channel_members', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      channel_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'channels', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      channel_role: {
        type: Sequelize.ENUM('member', 'admin'),
        allowNull: false,
        defaultValue: 'member',
      },
      // FK to messages.id added later (20260101000710) once the messages
      // table exists — channel_members is created before messages.
      last_read_message_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      last_read_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      joined_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('channel_members', ['channel_id', 'user_id'], { unique: true });
    await queryInterface.addIndex('channel_members', ['user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('channel_members');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_channel_members_channel_role";');
  },
};
