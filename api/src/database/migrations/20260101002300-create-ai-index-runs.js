'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ai_index_runs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'running', 'succeeded', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      trigger: {
        type: Sequelize.ENUM('script', 'api'),
        allowNull: false,
      },
      started_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      // Exactly one run may be `is_active: true` at a time (the run
      // retrieval.service.ts reads from) — enforced by the partial unique
      // index below, same pattern as users' partial-unique email index.
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      embedding_provider: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      file_count: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      chunk_count: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      embedded_chunk_count: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      finished_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('ai_index_runs', ['status']);
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX ai_index_runs_active_unique ON ai_index_runs (is_active) WHERE is_active;',
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_index_runs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ai_index_runs_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ai_index_runs_trigger";');
  },
};
