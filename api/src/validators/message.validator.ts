import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate';

export const listMessagesValidator = [
  param('channelId').isUUID(),
  query('before').optional().isUUID(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate,
];

export const createMessageValidator = [
  param('channelId').isUUID(),
  body('body').optional({ nullable: true }).isString(),
  body('replyToMessageId').optional({ nullable: true }).isUUID(),
  body('fileIds').optional().isArray(),
  body('fileIds.*').optional().isUUID(),
  validate,
];

export const messageIdParamValidator = [param('messageId').isUUID(), validate];

export const editMessageValidator = [
  param('messageId').isUUID(),
  body('body').isString().trim().notEmpty(),
  validate,
];
