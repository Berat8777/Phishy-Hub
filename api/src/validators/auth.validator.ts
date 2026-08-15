import { body } from 'express-validator';
import { validate } from '../middleware/validate';

export const registerValidator = [
  body('email').isEmail().withMessage('Must be a valid email').normalizeEmail(),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('firstName').isString().trim().notEmpty().withMessage('firstName is required'),
  body('lastName').isString().trim().notEmpty().withMessage('lastName is required'),
  body('departmentId').optional({ nullable: true }).isUUID().withMessage('departmentId must be a UUID'),
  validate,
];

export const loginValidator = [
  body('email').isEmail().withMessage('Must be a valid email').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('password is required'),
  validate,
];

export const refreshValidator = [
  body('refreshToken').isString().notEmpty().withMessage('refreshToken is required'),
  validate,
];

export const logoutValidator = [
  body('refreshToken').isString().notEmpty().withMessage('refreshToken is required'),
  validate,
];
