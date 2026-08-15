import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { registerValidator, loginValidator, refreshValidator, logoutValidator } from '../validators/auth.validator';
import { authRateLimit } from '../middleware/rateLimit';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.post('/register', authRateLimit, registerValidator, authController.register);
router.post('/login', authRateLimit, loginValidator, authController.login);
router.post('/refresh', authRateLimit, refreshValidator, authController.refresh);
router.post('/logout', logoutValidator, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
