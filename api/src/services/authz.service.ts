import { ChannelMember, Ticket, LeaveRequest, Message, MeetingParticipant, File, FileAttachment } from '../models';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import type { AttachableType, UserRole } from '../utils/constants';

/** Throws if the user is not a member of the channel. Returns the membership row otherwise. */
export async function assertChannelMember(
  userId: string,
  channelId: string,
): Promise<InstanceType<typeof ChannelMember>> {
  const membership = await ChannelMember.findOne({ where: { channelId, userId } });
  if (!membership) {
    throw new ForbiddenError('You are not a member of this channel');
  }
  return membership;
}

/** Throws unless the user is a channel-level admin OR a global admin. */
export async function assertChannelAdmin(userId: string, role: UserRole, channelId: string): Promise<void> {
  if (role === 'admin') return;
  const membership = await ChannelMember.findOne({ where: { channelId, userId } });
  if (!membership || membership.channelRole !== 'admin') {
    throw new ForbiddenError('Requires channel admin or global admin');
  }
}

export function assertMessageEditable(senderId: string, userId: string, role: UserRole): void {
  if (senderId === userId || role === 'admin') return;
  throw new ForbiddenError('Only the sender or an admin can edit/delete this message');
}

/** Ticket close: assignee or global admin only (architecture doc §3). */
export async function assertCanCloseTicket(ticketId: string, userId: string, role: UserRole): Promise<void> {
  if (role === 'admin') return;
  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) throw new NotFoundError('Ticket not found');
  if (ticket.assignedToId !== userId) {
    throw new ForbiddenError('Only the assignee or an admin can close this ticket');
  }
}

/** Leave request review: hr/admin only (architecture doc §3 RBAC matrix). */
export function assertCanReviewLeaveRequest(role: UserRole): void {
  if (role !== 'hr' && role !== 'admin') {
    throw new ForbiddenError('Only HR or admin can review leave requests');
  }
}

export function assertOwnsLeaveRequestOrPrivileged(
  leaveRequest: InstanceType<typeof LeaveRequest>,
  userId: string,
  role: UserRole,
): void {
  if (leaveRequest.userId === userId || role === 'hr' || role === 'admin') return;
  throw new ForbiddenError('You do not have access to this leave request');
}

/**
 * Checks whether `userId` is allowed to create a FileAttachment linking an
 * already-uploaded file to a given resource. Ticket attachments are
 * intentionally unrestricted beyond "any authenticated user" — tickets have
 * no read-visibility restriction in this app (see ticket.service.ts).
 */
export async function assertCanAttachFile(
  userId: string,
  role: UserRole,
  attachableType: AttachableType,
  attachableId: string,
): Promise<void> {
  switch (attachableType) {
    case 'message': {
      const message = await Message.findByPk(attachableId);
      if (!message) throw new NotFoundError('Message not found');
      if (message.senderId !== userId && role !== 'admin') {
        throw new ForbiddenError('Only the message sender or an admin can attach files to this message');
      }
      return;
    }
    case 'leave_request': {
      const leaveRequest = await LeaveRequest.findByPk(attachableId);
      if (!leaveRequest) throw new NotFoundError('Leave request not found');
      assertOwnsLeaveRequestOrPrivileged(leaveRequest, userId, role);
      return;
    }
    case 'meeting': {
      const participant = await MeetingParticipant.findOne({ where: { meetingId: attachableId, userId } });
      if (!participant && role !== 'admin') {
        throw new ForbiddenError('Only meeting participants or an admin can attach files to this meeting');
      }
      return;
    }
    case 'user_avatar': {
      if (attachableId !== userId && role !== 'admin') {
        throw new ForbiddenError('You can only set your own avatar');
      }
      return;
    }
    case 'ticket':
      // No read/write visibility restriction on tickets in this app.
      return;
    default:
      throw new ForbiddenError('Unsupported attachable type');
  }
}

async function canReadAttachment(
  userId: string,
  role: UserRole,
  attachableType: AttachableType,
  attachableId: string,
): Promise<boolean> {
  switch (attachableType) {
    case 'message': {
      const message = await Message.findByPk(attachableId);
      if (!message) return false;
      const membership = await ChannelMember.findOne({ where: { channelId: message.channelId, userId } });
      return Boolean(membership);
    }
    case 'leave_request': {
      const leaveRequest = await LeaveRequest.findByPk(attachableId);
      if (!leaveRequest) return false;
      return leaveRequest.userId === userId || role === 'hr' || role === 'admin';
    }
    case 'meeting': {
      const participant = await MeetingParticipant.findOne({ where: { meetingId: attachableId, userId } });
      return Boolean(participant);
    }
    case 'ticket':
      // No read-visibility restriction on tickets in this app.
      return true;
    case 'user_avatar':
      // Avatars are visible org-wide.
      return true;
    default:
      return false;
  }
}

/**
 * Checks whether `userId` may download a file: the uploader and global
 * admins always can; otherwise access follows the resource(s) the file is
 * attached to (a file with no attachments yet is only visible to its
 * uploader/admin).
 */
export async function assertCanAccessFile(
  userId: string,
  role: UserRole,
  file: InstanceType<typeof File>,
): Promise<void> {
  if (role === 'admin' || file.uploadedById === userId) return;

  const attachments = await FileAttachment.findAll({ where: { fileId: file.id } });
  for (const attachment of attachments) {
    if (await canReadAttachment(userId, role, attachment.attachableType, attachment.attachableId)) {
      return;
    }
  }

  throw new ForbiddenError('You do not have access to this file');
}
