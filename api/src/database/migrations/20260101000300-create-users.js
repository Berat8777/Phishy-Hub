'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        // NOT unique here on purpose — a plain unique constraint would
        // apply across soft-deleted rows too and permanently block
        // re-registering a deleted user's email. A *partial* unique index
        // (WHERE deleted_at IS NULL) is created below instead. See
        // architecture doc §7 risk #5.
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      first_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      last_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('employee', 'developer', 'sales', 'hr', 'admin'),
        allowNull: false,
        defaultValue: 'employee',
      },
      department_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'departments', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM('active', 'suspended', 'pending'),
        allowNull: false,
        defaultValue: 'active',
      },
      // FK to files.id added later (20260101000810) once the files table
      // exists — see architecture doc §6/§8, users is created before files.
      avatar_file_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      last_seen_at: {
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
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('users', ['department_id']);

    // Partial unique index: email must be unique only among non-deleted rows.
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX users_email_unique_not_deleted ON users (email) WHERE deleted_at IS NULL;',
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_status";');
  },
};
