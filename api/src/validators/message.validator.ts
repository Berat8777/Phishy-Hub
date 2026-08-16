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
  // Mirrors the socket `message:send` payload's `tempId` (message.handler.ts)
  // so a REST create (used whenever `fileIds` is present) can echo it back
  // on the `message:new` broadcast too — lets the sender's own client
  // reconcile its optimistic row by tempId instead of guessing, same as the
  // socket path already does. Client-generated (crypto.randomUUID()), never
  // persisted — purely a broadcast-correlation passthrough.
  body('tempId').optional({ nullable: true }).isString(),
  validate,
];

export const messageIdParamValidator = [param('messageId').isUUID(), validate];

export const editMessageValidator = [
  param('messageId').isUUID(),
  body('body').isString().trim().notEmpty(),
  validate,
];

export const listRepliesValidator = [
  param('messageId').isUUID(),
  query('before').optional().isUUID(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate,
];

export const searchMessagesValidator = [
  query('q').isString().trim().notEmpty(),
  query('channelId').optional().isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  validate,
];

export const addReactionValidator = [
  param('messageId').isUUID(),
  body('emoji').isString().trim().notEmpty().isLength({ max: 64 }),
  validate,
];

export const removeReactionValidator = [
  param('messageId').isUUID(),
  body('emoji').optional().isString().trim().notEmpty().isLength({ max: 64 }),
  query('emoji').optional().isString().trim().notEmpty().isLength({ max: 64 }),
  body().custom((_, { req }) => {
    if (!req.body?.emoji && !req.query?.emoji) {
      throw new Error('emoji is required (in body or query)');
    }
    return true;
  }),
  validate,
];
