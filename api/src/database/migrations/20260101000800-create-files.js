'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('files', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      storage_key: {
        type: Sequelize.STRING(1024),
        allowNull: false,
      },
      original_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      mime_type: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      size_bytes: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      uploaded_by_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      thumbnail_key: {
        type: Sequelize.STRING(1024),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('uploading', 'ready', 'failed'),
        allowNull: false,
        defaultValue: 'uploading',
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

    await queryInterface.addIndex('files', ['uploaded_by_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('files');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_files_status";');
  },
};
