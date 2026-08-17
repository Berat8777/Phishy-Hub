'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ai_queries', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      parent_query_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'ai_queries', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      channel_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'channels', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      message_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'messages', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      index_run_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'ai_index_runs', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      question: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      answer: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      citations: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      provider: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      model: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      input_tokens: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      output_tokens: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      latency_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'streaming', 'succeeded', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      error_code: {
        type: Sequelize.STRING(64),
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

    await queryInterface.addIndex('ai_queries', ['user_id']);
    await queryInterface.addIndex('ai_queries', ['channel_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_queries');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ai_queries_status";');
  },
};
