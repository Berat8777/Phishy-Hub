'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ai_chunks', {
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
      document_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'ai_documents', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      chunk_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      start_line: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      end_line: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      heading: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      char_count: {
        type: Sequelize.INTEGER,
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

    // `embedding`/`tsv` have no Sequelize DataTypes equivalent (no vector/
    // tsvector type in Sequelize 6) — added via raw SQL and read/written
    // exclusively via raw parameterized queries (services/ai/retrieval.service.ts,
    // indexing.service.ts), never as Sequelize model attributes. This mirrors
    // channel.service.ts::attachChannelListMeta's "raw SQL because Sequelize
    // can't express this" precedent.
    await queryInterface.sequelize.query('ALTER TABLE ai_chunks ADD COLUMN embedding vector(384);');
    await queryInterface.sequelize.query(
      `ALTER TABLE ai_chunks ADD COLUMN tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(heading, '') || ' ' || content)) STORED;`,
    );

    await queryInterface.sequelize.query('CREATE INDEX ai_chunks_tsv_gin ON ai_chunks USING GIN (tsv);');
    await queryInterface.sequelize.query(
      'CREATE INDEX ai_chunks_embedding_hnsw ON ai_chunks USING hnsw (embedding vector_cosine_ops);',
    );
    await queryInterface.addIndex('ai_chunks', ['index_run_id']);
    await queryInterface.addIndex('ai_chunks', ['document_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_chunks');
  },
};
