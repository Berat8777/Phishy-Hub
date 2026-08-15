import { Router } from 'express';
import * as fileController from '../controllers/file.controller';
import { fileIdParamValidator, attachFileValidator, uploadFileValidator } from '../validators/file.validator';
import { authenticate } from '../middleware/authenticate';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authenticate);

router.post('/', upload.single('file'), uploadFileValidator, fileController.upload);
router.get('/:id', fileIdParamValidator, fileController.getDownloadUrl);
router.post('/:id/attach', attachFileValidator, fileController.attach);
router.delete('/:id', fileIdParamValidator, fileController.remove);

export default router;
