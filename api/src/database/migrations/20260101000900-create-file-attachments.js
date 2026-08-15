'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('file_attachments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      file_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'files', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      attachable_type: {
        type: Sequelize.ENUM('message', 'ticket', 'leave_request', 'meeting', 'user_avatar'),
        allowNull: false,
      },
      // No DB-level FK — polymorphic target, enforced at app layer only.
      // See architecture doc §1.4.
      attachable_id: {
        type: Sequelize.UUID,
        allowNull: false,
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

    await queryInterface.addIndex('file_attachments', ['attachable_type', 'attachable_id']);
    await queryInterface.addIndex('file_attachments', ['file_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('file_attachments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_file_attachments_attachable_type";');
  },
};
