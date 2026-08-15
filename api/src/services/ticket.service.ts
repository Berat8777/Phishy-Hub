import { Ticket, User, Department } from '../models';
import { assertCanCloseTicket } from './authz.service';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { paginate, PaginationParams } from './pagination.service';
import { createNotification } from './notification.service';
import type { TicketPriority, TicketStatus, UserRole } from '../utils/constants';

const TICKET_INCLUDE = [
  { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName', 'email'] },
  { model: User, as: 'assignee', attributes: ['id', 'firstName', 'lastName', 'email'] },
  { model: Department, as: 'department', attributes: ['id', 'name'] },
];

async function getOrThrow(id: string): Promise<InstanceType<typeof Ticket>> {
  const ticket = await Ticket.findByPk(id, { include: TICKET_INCLUDE });
  if (!ticket) throw new NotFoundError('Ticket not found');
  return ticket;
}

export async function createTicket(
  userId: string,
  input: { title: string; description?: string; priority?: TicketPriority; departmentId?: string | null },
): Promise<InstanceType<typeof Ticket>> {
  const ticket = await Ticket.create({
    title: input.title.trim(),
    description: input.description ?? null,
    priority: input.priority ?? 'medium',
    status: 'open',
    createdById: userId,
    departmentId: input.departmentId ?? null,
  });
  return getOrThrow(ticket.id);
}

export async function listTickets(
  params: PaginationParams & {
    status?: TicketStatus;
    priority?: TicketPriority;
    assignedToId?: string;
    departmentId?: string;
  },
) {
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (params.priority) where.priority = params.priority;
  if (params.assignedToId) where.assignedToId = params.assignedToId;
  if (params.departmentId) where.departmentId = params.departmentId;
  return paginate(Ticket, params, { where, include: TICKET_INCLUDE });
}

export async function getTicketById(id: string): Promise<InstanceType<typeof Ticket>> {
  return getOrThrow(id);
}

export async function assignTicket(id: string, assignedToId: string | null): Promise<InstanceType<typeof Ticket>> {
  const ticket = await getOrThrow(id);
  if (assignedToId) {
    const assignee = await User.findByPk(assignedToId);
    if (!assignee) throw new BadRequestError('assignedToId does not reference an existing user');
  }
  ticket.assignedToId = assignedToId;
  await ticket.save();

  if (assignedToId) {
    await createNotification(assignedToId, 'ticket_assigned', { ticketId: ticket.id, title: ticket.title });
  }

  return getOrThrow(ticket.id);
}

export async function updateTicketStatus(
  userId: string,
  role: UserRole,
  id: string,
  status: TicketStatus,
): Promise<InstanceType<typeof Ticket>> {
  const ticket = await getOrThrow(id);
  if (status === 'closed') {
    await assertCanCloseTicket(id, userId, role);
  }
  ticket.status = status;
  await ticket.save();
  return getOrThrow(ticket.id);
}

export async function updateTicket(
  id: string,
  input: { title?: string; description?: string; priority?: TicketPriority; departmentId?: string | null },
): Promise<InstanceType<typeof Ticket>> {
  const ticket = await getOrThrow(id);
  if (input.title !== undefined) ticket.title = input.title.trim();
  if (input.description !== undefined) ticket.description = input.description;
  if (input.priority !== undefined) ticket.priority = input.priority;
  if (input.departmentId !== undefined) ticket.departmentId = input.departmentId;
  await ticket.save();
  return getOrThrow(ticket.id);
}
