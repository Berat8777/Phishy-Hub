import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import {
  userIdParamValidator,
  listUsersValidator,
  updateOwnProfileValidator,
  changePasswordValidator,
  adminCreateUserValidator,
  adminUpdateUserValidator,
} from '../validators/user.validator';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

router.get('/', listUsersValidator, userController.list);
router.patch('/me', updateOwnProfileValidator, userController.updateMe);
router.post('/me/change-password', changePasswordValidator, userController.changePassword);
router.post('/', authorize('admin', 'hr'), adminCreateUserValidator, userController.adminCreate);
router.get('/:id', userIdParamValidator, userController.getById);
router.patch('/:id', authorize('admin', 'hr'), adminUpdateUserValidator, userController.adminUpdate);
router.delete('/:id', authorize('admin'), userIdParamValidator, userController.remove);

export default router;
