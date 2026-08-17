'use strict';

const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');

// Kept in sync with api/src/utils/constants.ts::AI_BOT_USER_ID — a fixed,
// well-known id so services/controllers can reference the bot without a
// lookup. Duplicated here (not imported) because this file runs as plain
// CommonJS through sequelize-cli, same constraint as the rest of
// database/seeders/migrations.
const AI_BOT_USER_ID = '00000000-0000-4000-8000-00000000a1a1';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

/**
 * Idempotent upsert of the `@ai` bot user (Module 7) — safe to run multiple
 * times (`ON CONFLICT DO NOTHING`/`DO UPDATE`), unlike the plain
 * `bulkInsert` the original demo seeder uses, since this seeder may need to
 * run against a DB where the main demo seed already executed.
 */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    // No real login is ever possible for this user (auth.service.ts rejects
    // isBot logins outright), so the password hash is just a random,
    // unusable placeholder.
    const passwordHash = await bcrypt.hash(randomUUID(), BCRYPT_ROUNDS);

    await queryInterface.sequelize.query(
      `
      INSERT INTO users (id, email, password_hash, first_name, last_name, role, department_id, status, is_bot, created_at, updated_at)
      VALUES (:id, :email, :passwordHash, :firstName, :lastName, 'employee', NULL, 'active', true, :now, :now)
      ON CONFLICT (id) DO UPDATE SET is_bot = true
      `,
      {
        replacements: {
          id: AI_BOT_USER_ID,
          email: 'ai@phishyhub.local',
          passwordHash,
          firstName: 'AI',
          lastName: 'Assistant',
          now,
        },
      },
    );

    // Add the bot to #general if that seed channel exists — best-effort,
    // matches how aiMention.service.ts idempotently ensures membership at
    // mention-time for any other channel.
    const [generalChannel] = await queryInterface.sequelize.query(
      `SELECT id FROM channels WHERE name = 'general' AND deleted_at IS NULL LIMIT 1`,
    );
    if (generalChannel.length > 0) {
      await queryInterface.sequelize.query(
        `
        INSERT INTO channel_members (id, channel_id, user_id, channel_role, joined_at, created_at, updated_at)
        VALUES (:id, :channelId, :userId, 'member', :now, :now, :now)
        ON CONFLICT DO NOTHING
        `,
        {
          replacements: { id: randomUUID(), channelId: generalChannel[0].id, userId: AI_BOT_USER_ID, now },
        },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DELETE FROM users WHERE id = :id', {
      replacements: { id: AI_BOT_USER_ID },
    });
  },
};
