import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { notificationIdParamValidator, listNotificationsValidator } from '../validators/notification.validator';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/', listNotificationsValidator, notificationController.list);
router.post('/read-all', notificationController.markAllRead);
router.post('/:id/read', notificationIdParamValidator, notificationController.markRead);

export default router;
