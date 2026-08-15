import { Router } from 'express';
import * as meetingController from '../controllers/meeting.controller';
import {
  meetingIdParamValidator,
  listMeetingsValidator,
  createMeetingValidator,
  respondToMeetingValidator,
} from '../validators/meeting.validator';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/', listMeetingsValidator, meetingController.list);
router.post('/', createMeetingValidator, meetingController.create);
router.get('/:id', meetingIdParamValidator, meetingController.getById);
router.post('/:id/respond', respondToMeetingValidator, meetingController.respond);

export default router;
