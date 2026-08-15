import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate';
import { CHANNEL_TYPES } from '../utils/constants';

export const channelIdParamValidator = [param('channelId').isUUID(), validate];

const SORTABLE_FIELDS = ['name', 'type', 'createdAt', 'updatedAt'];

export const listChannelsValidator = [
  query('type').optional().isIn(CHANNEL_TYPES),
  query('sort').optional().isIn(SORTABLE_FIELDS),
  query('order').optional().isIn(['ASC', 'DESC', 'asc', 'desc']),
  validate,
];

export const createChannelValidator = [
  body('type').isIn(CHANNEL_TYPES),
  body('name').optional({ nullable: true }).isString().trim(),
  body('departmentId').optional({ nullable: true }).isUUID(),
  body('memberIds').optional().isArray(),
  body('memberIds.*').optional().isUUID(),
  validate,
];

export const addMemberValidator = [
  param('channelId').isUUID(),
  body('userId').isUUID(),
  validate,
];

export const removeMemberValidator = [param('channelId').isUUID(), param('userId').isUUID(), validate];
