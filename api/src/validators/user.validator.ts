import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate';
import { USER_ROLES, USER_STATUSES } from '../utils/constants';

export const userIdParamValidator = [param('id').isUUID(), validate];

const SORTABLE_FIELDS = ['firstName', 'lastName', 'email', 'role', 'status', 'createdAt', 'updatedAt', 'lastSeenAt'];

export const listUsersValidator = [
  query('role').optional().isIn(USER_ROLES),
  query('status').optional().isIn(USER_STATUSES),
  query('departmentId').optional().isUUID(),
  query('sort').optional().isIn(SORTABLE_FIELDS),
  query('order').optional().isIn(['ASC', 'DESC', 'asc', 'desc']),
  validate,
];

export const updateOwnProfileValidator = [
  body('firstName').optional().isString().trim().notEmpty(),
  body('lastName').optional().isString().trim().notEmpty(),
  body('avatarFileId').optional({ nullable: true }).isUUID(),
  validate,
];

export const changePasswordValidator = [
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 8 }).withMessage('newPassword must be at least 8 characters'),
  validate,
];

export const adminCreateUserValidator = [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8 }),
  body('firstName').isString().trim().notEmpty(),
  body('lastName').isString().trim().notEmpty(),
  body('role').optional().isIn(USER_ROLES),
  body('departmentId').optional({ nullable: true }).isUUID(),
  validate,
];

export const adminUpdateUserValidator = [
  param('id').isUUID(),
  body('role').optional().isIn(USER_ROLES),
  body('status').optional().isIn(USER_STATUSES),
  body('departmentId').optional({ nullable: true }).isUUID(),
  validate,
];
