import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate';
import { LEAVE_REQUEST_STATUSES, LEAVE_REQUEST_TYPES } from '../utils/constants';

export const leaveRequestIdParamValidator = [param('id').isUUID(), validate];

const SORTABLE_FIELDS = ['startDate', 'endDate', 'status', 'type', 'createdAt', 'updatedAt'];

export const listLeaveRequestsValidator = [
  query('status').optional().isIn(LEAVE_REQUEST_STATUSES),
  query('userId').optional().isUUID(),
  query('sort').optional().isIn(SORTABLE_FIELDS),
  query('order').optional().isIn(['ASC', 'DESC', 'asc', 'desc']),
  validate,
];

export const createLeaveRequestValidator = [
  body('type').isIn(LEAVE_REQUEST_TYPES),
  body('startDate').isISO8601().withMessage('startDate must be an ISO 8601 date'),
  body('endDate').isISO8601().withMessage('endDate must be an ISO 8601 date'),
  body('reason').optional({ nullable: true }).isString(),
  validate,
];

export const reviewLeaveRequestValidator = [
  param('id').isUUID(),
  body('status').isIn(['approved', 'rejected']),
  body('reviewNote').optional({ nullable: true }).isString(),
  validate,
];
