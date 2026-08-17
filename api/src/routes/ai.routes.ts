import { NextFunction, Request, Response, Router } from 'express';
import * as aiController from '../controllers/ai.controller';
import {
  aiQueryValidator,
  listAiQueriesValidator,
  aiQueryIdParamValidator,
  aiSearchValidator,
  listAiIndexRunsValidator,
  listAiDocumentsValidator,
} from '../validators/ai.validator';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { aiQueryRateLimit } from '../middleware/rateLimit';
import { assertCanUseAi } from '../services/ai/aiQuery.service';

const router = Router();

router.use(authenticate);

/** Resource-level gate (configurable via `AI_ALLOWED_ROLES`, not a fixed role list like `authorize()`). */
function requireAiRole(req: Request, _res: Response, next: NextFunction): void {
  try {
    assertCanUseAi(req.user!.role);
    next();
  } catch (err) {
    next(err);
  }
}

router.get('/status', requireAiRole, aiController.status);
router.post('/query', requireAiRole, aiQueryRateLimit, aiQueryValidator, aiController.query);
router.get('/queries', listAiQueriesValidator, aiController.listQueries);
router.get('/queries/:id', aiQueryIdParamValidator, aiController.getQuery);
router.post('/search', requireAiRole, aiSearchValidator, aiController.search);
router.post('/index', authorize('admin'), aiController.startIndex);
router.get('/index/status', requireAiRole, aiController.indexStatus);
router.get('/index/runs', authorize('admin'), listAiIndexRunsValidator, aiController.listIndexRuns);
router.get('/documents', authorize('admin'), listAiDocumentsValidator, aiController.listDocuments);

export default router;
