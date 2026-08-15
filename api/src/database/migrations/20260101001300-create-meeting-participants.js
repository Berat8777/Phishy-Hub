'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('meeting_participants', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      meeting_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'meetings', key: 'id' },
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
      rsvp_status: {
        type: Sequelize.ENUM('invited', 'accepted', 'declined', 'tentative'),
        allowNull: false,
        defaultValue: 'invited',
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

    await queryInterface.addIndex('meeting_participants', ['meeting_id', 'user_id'], { unique: true });
    await queryInterface.addIndex('meeting_participants', ['user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('meeting_participants');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_meeting_participants_rsvp_status";');
  },
};
