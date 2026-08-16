import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate';
import { ATTACHABLE_TYPES } from '../utils/constants';

export const fileIdParamValidator = [param('id').isUUID(), validate];

export const getDownloadUrlValidator = [
  param('id').isUUID(),
  query('variant').optional().isIn(['original', 'thumbnail']),
  validate,
];

export const attachFileValidator = [
  param('id').isUUID(),
  body('attachableType').isIn(ATTACHABLE_TYPES),
  body('attachableId').isUUID(),
  validate,
];

/**
 * `POST /files` accepts attachableType/attachableId as optional multipart
 * text fields for a same-request attach — must run AFTER `upload.single()`
 * since that's what populates `req.body` for a multipart request in the
 * first place. Both-or-neither: either field present without the other is
 * a malformed request, not "just skip the attach".
 */
export const uploadFileValidator = [
  body('attachableType').optional().isIn(ATTACHABLE_TYPES),
  body('attachableId').optional().isUUID(),
  body().custom((_, { req }) => {
    const hasType = req.body?.attachableType !== undefined;
    const hasId = req.body?.attachableId !== undefined;
    if (hasType !== hasId) {
      throw new Error('attachableType and attachableId must be provided together');
    }
    return true;
  }),
  validate,
];
