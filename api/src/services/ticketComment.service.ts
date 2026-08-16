import { Ticket, TicketComment, User } from '../models';
import { assertCanEditTicketComment } from './authz.service';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { paginate, PaginationParams } from './pagination.service';
import { createNotification } from './notification.service';
import type { UserRole } from '../utils/constants';

const AUTHOR_INCLUDE = [{ model: User, as: 'author', attributes: ['id', 'firstName', 'lastName', 'avatarFileId'] }];

async function getTicketOrThrow(ticketId: string): Promise<InstanceType<typeof Ticket>> {
  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) throw new NotFoundError('Ticket not found');
  return ticket;
}

async function getCommentOrThrow(ticketId: string, commentId: string): Promise<InstanceType<typeof TicketComment>> {
  const comment = await TicketComment.findOne({ where: { id: commentId, ticketId }, include: AUTHOR_INCLUDE });
  if (!comment) throw new NotFoundError('Comment not found');
  return comment;
}

export async function listComments(ticketId: string, params: PaginationParams) {
  await getTicketOrThrow(ticketId);
  return paginate(TicketComment, params, { where: { ticketId }, include: AUTHOR_INCLUDE }, 'createdAt');
}

/** Notifies the ticket's creator and current assignee (skipping the comment's own author), mirroring ticket.service.ts::assignTicket's notification. */
export async function createComment(
  userId: string,
  ticketId: string,
  body: string,
): Promise<InstanceType<typeof TicketComment>> {
  const ticket = await getTicketOrThrow(ticketId);
  const trimmed = body.trim();
  if (!trimmed) throw new BadRequestError('body is required');

  const comment = await TicketComment.create({ ticketId, authorId: userId, body: trimmed });

  const notifyIds = new Set<string>();
  if (ticket.createdById !== userId) notifyIds.add(ticket.createdById);
  if (ticket.assignedToId && ticket.assignedToId !== userId) notifyIds.add(ticket.assignedToId);
  await Promise.all(
    [...notifyIds].map((id) =>
      createNotification(id, 'ticket_comment_added', { ticketId, commentId: comment.id, title: ticket.title }),
    ),
  );

  const loaded = await TicketComment.findByPk(comment.id, { include: AUTHOR_INCLUDE });
  return loaded!;
}

export async function updateComment(
  userId: string,
  role: UserRole,
  ticketId: string,
  commentId: string,
  body: string,
): Promise<InstanceType<typeof TicketComment>> {
  const comment = await getCommentOrThrow(ticketId, commentId);
  assertCanEditTicketComment(comment.authorId, userId, role);
  comment.body = body.trim();
  await comment.save();
  return comment;
}

export async function deleteComment(userId: string, role: UserRole, ticketId: string, commentId: string): Promise<void> {
  const comment = await getCommentOrThrow(ticketId, commentId);
  assertCanEditTicketComment(comment.authorId, userId, role);
  await comment.destroy();
}
