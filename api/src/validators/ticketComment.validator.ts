import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate';

const SORTABLE_FIELDS = ['createdAt', 'updatedAt'];

export const listTicketCommentsValidator = [
  param('id').isUUID(),
  query('sort').optional().isIn(SORTABLE_FIELDS),
  query('order').optional().isIn(['ASC', 'DESC', 'asc', 'desc']),
  validate,
];

export const createTicketCommentValidator = [
  param('id').isUUID(),
  body('body').isString().trim().notEmpty().withMessage('body is required'),
  validate,
];

export const updateTicketCommentValidator = [
  param('id').isUUID(),
  param('commentId').isUUID(),
  body('body').isString().trim().notEmpty().withMessage('body is required'),
  validate,
];

export const ticketCommentIdParamValidator = [param('id').isUUID(), param('commentId').isUUID(), validate];
