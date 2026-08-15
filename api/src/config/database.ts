import { Sequelize } from 'sequelize';
import { env } from './env';
import { logger } from '../utils/logger';

export const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'postgres',
  logging: env.db.logging ? (sql: string) => logger.debug(sql) : false,
  define: {
    underscored: true,
  },
});

export async function assertDatabaseConnection(): Promise<void> {
  await sequelize.authenticate();
}
