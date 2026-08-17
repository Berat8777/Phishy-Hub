'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ai_documents', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      index_run_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'ai_index_runs', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      // Repo-relative path with POSIX separators (never absolute, never
      // backslash) — see services/ai/fileWalker.ts.
      path: {
        type: Sequelize.STRING(1024),
        allowNull: false,
      },
      language: {
        type: Sequelize.STRING(32),
        allowNull: true,
      },
      size_bytes: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      line_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      content_hash: {
        type: Sequelize.CHAR(64),
        allowNull: false,
      },
      chunk_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex('ai_documents', ['index_run_id']);
    await queryInterface.addIndex('ai_documents', ['index_run_id', 'path'], {
      unique: true,
      name: 'ai_documents_index_run_path_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_documents');
  },
};
