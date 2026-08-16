import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate';

const SORTABLE_FIELDS = ['name', 'createdAt', 'updatedAt'];

export const listDepartmentsValidator = [
  query('sort').optional().isIn(SORTABLE_FIELDS),
  query('order').optional().isIn(['ASC', 'DESC', 'asc', 'desc']),
  validate,
];

export const createDepartmentValidator = [
  body('name').isString().trim().notEmpty().withMessage('name is required'),
  body('managerId').optional({ nullable: true }).isUUID(),
  validate,
];

export const updateDepartmentValidator = [
  param('id').isUUID(),
  body('name').optional().isString().trim().notEmpty().withMessage('name is required'),
  body('managerId').optional({ nullable: true }).isUUID(),
  validate,
];

export const departmentIdParamValidator = [param('id').isUUID(), validate];
