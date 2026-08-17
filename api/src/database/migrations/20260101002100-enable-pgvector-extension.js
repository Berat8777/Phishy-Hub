'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Requires the pgvector/pgvector:pg15 image (see docker-compose.yml) —
    // plain postgres:15-alpine does not ship this extension's binary.
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS vector;');
  },
};
