'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('leave_request_reviews', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      leave_request_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'leave_requests', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      reviewer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      stage: {
        type: Sequelize.ENUM('manager', 'hr'),
        allowNull: false,
      },
      decision: {
        type: Sequelize.ENUM('approve', 'reject'),
        allowNull: false,
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('leave_request_reviews', ['leave_request_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('leave_request_reviews');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_leave_request_reviews_stage";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_leave_request_reviews_decision";');
  },
};
