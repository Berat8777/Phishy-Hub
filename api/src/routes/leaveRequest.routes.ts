import { Router } from 'express';
import * as leaveRequestController from '../controllers/leaveRequest.controller';
import {
  leaveRequestIdParamValidator,
  listLeaveRequestsValidator,
  createLeaveRequestValidator,
  reviewLeaveRequestValidator,
} from '../validators/leaveRequest.validator';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/', listLeaveRequestsValidator, leaveRequestController.list);
router.post('/', createLeaveRequestValidator, leaveRequestController.create);
router.get('/:id', leaveRequestIdParamValidator, leaveRequestController.getById);
router.post('/:id/review', reviewLeaveRequestValidator, leaveRequestController.review);
router.post('/:id/cancel', leaveRequestIdParamValidator, leaveRequestController.cancel);

export default router;
