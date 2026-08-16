import { Router } from 'express';
import * as messageController from '../controllers/message.controller';
import {
  listMessagesValidator,
  createMessageValidator,
  messageIdParamValidator,
  editMessageValidator,
  listRepliesValidator,
  searchMessagesValidator,
  addReactionValidator,
  removeReactionValidator,
} from '../validators/message.validator';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/channels/:channelId/messages', listMessagesValidator, messageController.list);
router.post('/channels/:channelId/messages', createMessageValidator, messageController.create);
// Must be registered before /messages/:messageId patterns so a literal
// "search" path segment can never be misread as a messageId param.
router.get('/messages/search', searchMessagesValidator, messageController.search);
router.get('/messages/:messageId/replies', listRepliesValidator, messageController.listReplies);
router.put('/messages/:messageId/reactions', addReactionValidator, messageController.addReaction);
router.delete('/messages/:messageId/reactions', removeReactionValidator, messageController.removeReaction);
router.patch('/messages/:messageId', editMessageValidator, messageController.update);
router.delete('/messages/:messageId', messageIdParamValidator, messageController.remove);

export default router;
