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

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const createLeaveRequestValidator = [
  body('type').isIn(LEAVE_REQUEST_TYPES),
  body('startDate').matches(DATE_ONLY_PATTERN).withMessage('startDate must be a "YYYY-MM-DD" date'),
  body('endDate').matches(DATE_ONLY_PATTERN).withMessage('endDate must be a "YYYY-MM-DD" date'),
  body('reason').optional({ nullable: true }).isString(),
  validate,
];

export const reviewLeaveRequestValidator = [
  param('id').isUUID(),
  body('decision').isIn(['approve', 'reject']),
  body('reviewNote').optional({ nullable: true }).isString(),
  validate,
];

export const leaveBalanceQueryValidator = [
  query('userId').optional().isUUID(),
  query('year').optional().isInt({ min: 2000, max: 2100 }).withMessage('year must be a 4-digit year'),
  validate,
];

export const leaveCalendarQueryValidator = [
  query('from').matches(DATE_ONLY_PATTERN).withMessage('from must be a "YYYY-MM-DD" date'),
  query('to').matches(DATE_ONLY_PATTERN).withMessage('to must be a "YYYY-MM-DD" date'),
  query('departmentId').optional().isUUID(),
  validate,
];
