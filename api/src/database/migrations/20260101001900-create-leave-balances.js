'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('leave_balances', {
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
      year: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      type: {
        // Matches LeaveRequest.type's enum values (annual/sick/unpaid/other) —
        // a separate Postgres enum type since sequelize-cli doesn't let two
        // tables share one ENUM type definition cleanly.
        type: Sequelize.ENUM('annual', 'sick', 'unpaid', 'other'),
        allowNull: false,
      },
      entitled_days: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      carried_over_days: {
        type: Sequelize.DECIMAL(5, 2),
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

    await queryInterface.addIndex('leave_balances', ['user_id', 'year', 'type'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('leave_balances');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_leave_balances_type";');
  },
};
