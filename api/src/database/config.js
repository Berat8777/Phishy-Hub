// sequelize-cli connection config. Deliberately plain CommonJS (not compiled
// from TS) so `sequelize-cli` can load it directly without a build step —
// see architecture doc §1.1. The app's own runtime Sequelize instance lives
// in src/config/database.ts and reads the same env vars.
require('dotenv').config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const base = {
  username: requireEnv('DB_USER'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_NAME'),
  host: requireEnv('DB_HOST'),
  port: Number(requireEnv('DB_PORT')),
  dialect: 'postgres',
  define: {
    underscored: true,
  },
};

module.exports = {
  development: base,
  test: base,
  production: base,
};
