import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../utils/constants';

export const ticketIdParamValidator = [param('id').isUUID(), validate];

const SORTABLE_FIELDS = ['title', 'status', 'priority', 'createdAt', 'updatedAt'];

export const listTicketsValidator = [
  query('status').optional().isIn(TICKET_STATUSES),
  query('priority').optional().isIn(TICKET_PRIORITIES),
  query('assignedToId').optional().isUUID(),
  query('departmentId').optional().isUUID(),
  query('sort').optional().isIn(SORTABLE_FIELDS),
  query('order').optional().isIn(['ASC', 'DESC', 'asc', 'desc']),
  validate,
];

export const createTicketValidator = [
  body('title').isString().trim().notEmpty(),
  body('description').optional({ nullable: true }).isString(),
  body('priority').optional().isIn(TICKET_PRIORITIES),
  body('departmentId').optional({ nullable: true }).isUUID(),
  validate,
];

export const updateTicketValidator = [
  param('id').isUUID(),
  body('title').optional().isString().trim().notEmpty(),
  body('description').optional({ nullable: true }).isString(),
  body('priority').optional().isIn(TICKET_PRIORITIES),
  body('departmentId').optional({ nullable: true }).isUUID(),
  validate,
];

export const assignTicketValidator = [
  param('id').isUUID(),
  body('assignedToId').optional({ nullable: true }).isUUID(),
  validate,
];

export const updateTicketStatusValidator = [
  param('id').isUUID(),
  body('status').isIn(TICKET_STATUSES),
  validate,
];
