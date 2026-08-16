import { Router } from 'express';
import * as leaveRequestController from '../controllers/leaveRequest.controller';
import { leaveCalendarQueryValidator } from '../validators/leaveRequest.validator';
import { authenticate } from '../middleware/authenticate';

/**
 * `GET /leave-calendar` — a dedicated top-level route (NOT nested under
 * `/leave-requests`) per the architect's design, since it returns a
 * structurally distinct, redacted projection rather than a leave-request
 * list. See leaveRequest.service.ts::getLeaveCalendar().
 */
const router = Router();

router.use(authenticate);

router.get('/', leaveCalendarQueryValidator, leaveRequestController.getCalendar);

export default router;
