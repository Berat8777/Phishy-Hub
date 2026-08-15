import { Router } from 'express';
import * as departmentController from '../controllers/department.controller';
import {
  createDepartmentValidator,
  updateDepartmentValidator,
  departmentIdParamValidator,
  listDepartmentsValidator,
} from '../validators/department.validator';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

router.get('/', listDepartmentsValidator, departmentController.list);
router.get('/:id', departmentIdParamValidator, departmentController.getById);
router.post('/', authorize('admin', 'hr'), createDepartmentValidator, departmentController.create);
router.patch('/:id', authorize('admin', 'hr'), updateDepartmentValidator, departmentController.update);
router.delete('/:id', authorize('admin'), departmentIdParamValidator, departmentController.remove);

export default router;
