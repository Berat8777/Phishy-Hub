import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../utils/constants';

export const ticketIdParamValidator = [param('id').isUUID(), validate];

const SORTABLE_FIELDS = ['title', 'status', 'priority', 'createdAt', 'updatedAt'];

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const listTicketsValidator = [
  query('status').optional().isIn(TICKET_STATUSES),
  query('priority').optional().isIn(TICKET_PRIORITIES),
  // 'none' is a special-case meaning "unassigned" (WHERE assigned_to_id IS
  // NULL) — otherwise must be a real UUID. See ticket.service.ts::listTickets.
  query('assignedToId')
    .optional()
    .custom((value) => value === 'none' || UUID_RE.test(value))
    .withMessage('assignedToId must be a UUID or "none"'),
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
