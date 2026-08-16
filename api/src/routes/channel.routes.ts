import { Router } from 'express';
import * as channelController from '../controllers/channel.controller';
import {
  channelIdParamValidator,
  listChannelsValidator,
  createChannelValidator,
  createDmValidator,
  addMemberValidator,
  removeMemberValidator,
} from '../validators/channel.validator';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/', listChannelsValidator, channelController.list);
router.post('/', createChannelValidator, channelController.create);
// Must be registered before /:channelId so the literal "dm" path segment
// can never be misread as a channelId param.
router.post('/dm', createDmValidator, channelController.createOrGetDm);
router.get('/:channelId', channelIdParamValidator, channelController.getById);
router.get('/:channelId/members', channelIdParamValidator, channelController.listMembers);
router.post('/:channelId/join', channelIdParamValidator, channelController.join);
router.post('/:channelId/leave', channelIdParamValidator, channelController.leave);
router.post('/:channelId/members', addMemberValidator, channelController.addMember);
router.delete('/:channelId/members/:userId', removeMemberValidator, channelController.removeMember);
router.post('/:channelId/archive', channelIdParamValidator, channelController.archive);

export default router;
