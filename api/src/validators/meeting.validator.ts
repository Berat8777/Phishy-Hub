import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate';
import { RSVP_STATUSES } from '../utils/constants';

export const meetingIdParamValidator = [param('id').isUUID(), validate];

const SORTABLE_FIELDS = ['title', 'startTime', 'endTime', 'createdAt', 'updatedAt'];

export const listMeetingsValidator = [
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('sort').optional().isIn(SORTABLE_FIELDS),
  query('order').optional().isIn(['ASC', 'DESC', 'asc', 'desc']),
  validate,
];

export const createMeetingValidator = [
  body('title').isString().trim().notEmpty(),
  body('description').optional({ nullable: true }).isString(),
  body('startTime').isISO8601(),
  body('endTime').isISO8601(),
  body('location').optional({ nullable: true }).isString(),
  body('channelId').optional({ nullable: true }).isUUID(),
  body('participantIds').optional().isArray(),
  body('participantIds.*').optional().isUUID(),
  validate,
];

export const respondToMeetingValidator = [
  param('id').isUUID(),
  body('rsvpStatus').isIn(RSVP_STATUSES),
  validate,
];
