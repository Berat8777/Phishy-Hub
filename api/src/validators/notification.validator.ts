import { param, query } from 'express-validator';
import { validate } from '../middleware/validate';

export const notificationIdParamValidator = [param('id').isUUID(), validate];

const SORTABLE_FIELDS = ['type', 'isRead', 'createdAt', 'updatedAt'];

export const listNotificationsValidator = [
  query('isRead').optional().isBoolean(),
  query('sort').optional().isIn(SORTABLE_FIELDS),
  query('order').optional().isIn(['ASC', 'DESC', 'asc', 'desc']),
  validate,
];
