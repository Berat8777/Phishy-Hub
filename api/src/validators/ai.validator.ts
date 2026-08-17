import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate';

export const aiQueryValidator = [
  body('question').isString().trim().notEmpty().isLength({ max: 4000 }),
  body('channelId').optional({ nullable: true }).isUUID(),
  body('parentQueryId').optional({ nullable: true }).isUUID(),
  body('stream').optional().isBoolean(),
  validate,
];

export const listAiQueriesValidator = [
  query('userId').optional().isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  validate,
];

export const aiQueryIdParamValidator = [param('id').isUUID(), validate];

export const aiSearchValidator = [
  body('q').isString().trim().notEmpty().isLength({ max: 1000 }),
  body('limit').optional().isInt({ min: 1, max: 30 }),
  validate,
];

export const listAiIndexRunsValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  validate,
];

export const listAiDocumentsValidator = [
  query('q').optional().isString().trim(),
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  validate,
];
