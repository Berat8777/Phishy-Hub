'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Postgres enum values can only be appended, never removed/reordered,
    // and `ALTER TYPE ... ADD VALUE` cannot run inside the same transaction
    // as other schema changes that might use the new value — so this is its
    // own standalone migration. `IF NOT EXISTS` makes it safe to re-run.
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_leave_requests_status" ADD VALUE IF NOT EXISTS 'manager_approved';`,
    );
  },

  async down() {
    // No-op, documented: Postgres has no `ALTER TYPE ... DROP VALUE` — an
    // enum value, once added, cannot be removed (short of recreating the
    // type and every column/dependent object that uses it). Reversing this
    // migration would require a destructive rebuild that's out of scope
    // here; `manager_approved` staying in the type after a down-migration is
    // considered an acceptable, permanent side effect.
  },
};
