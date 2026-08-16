'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('message_reactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      message_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'messages', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      emoji: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // A user can react with the same emoji only once per message (idempotent
    // add), but may add several different emoji to the same message.
    await queryInterface.addIndex('message_reactions', ['message_id', 'user_id', 'emoji'], { unique: true });
    await queryInterface.addIndex('message_reactions', ['message_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('message_reactions');
  },
};
