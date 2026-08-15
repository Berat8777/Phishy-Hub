import { Router } from 'express';
import * as messageController from '../controllers/message.controller';
import {
  listMessagesValidator,
  createMessageValidator,
  messageIdParamValidator,
  editMessageValidator,
} from '../validators/message.validator';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/channels/:channelId/messages', listMessagesValidator, messageController.list);
router.post('/channels/:channelId/messages', createMessageValidator, messageController.create);
router.patch('/messages/:messageId', editMessageValidator, messageController.update);
router.delete('/messages/:messageId', messageIdParamValidator, messageController.remove);

export default router;
