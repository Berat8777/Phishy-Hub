import { Router } from 'express';
import { sequelize } from '../config/database';
import { sendSuccess } from '../utils/response';

const router = Router();

// Unversioned, mounted directly on the app (not under /api/v1) so
// load balancers / process managers can probe it trivially.
router.get('/health', async (_req, res) => {
  let dbStatus: 'ok' | 'error' = 'ok';
  try {
    await sequelize.authenticate();
  } catch {
    dbStatus = 'error';
  }

  sendSuccess(res, {
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    db: dbStatus,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
