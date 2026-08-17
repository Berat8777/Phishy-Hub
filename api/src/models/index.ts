import { sequelize } from '../config/database';
import { Organization } from './organization.model';
import { Department } from './department.model';
import { User } from './user.model';
import { RefreshToken } from './refreshToken.model';
import { Channel } from './channel.model';
import { ChannelMember } from './channelMember.model';
import { Message } from './message.model';
import { MessageReaction } from './messageReaction.model';
import { File } from './file.model';
import { FileAttachment } from './fileAttachment.model';
import { LeaveRequest } from './leaveRequest.model';
import { LeaveRequestReview } from './leaveRequestReview.model';
import { LeaveBalance } from './leaveBalance.model';
import { Ticket } from './ticket.model';
import { TicketComment } from './ticketComment.model';
import { Meeting } from './meeting.model';
import { MeetingParticipant } from './meetingParticipant.model';
import { Notification } from './notification.model';
import { AiIndexRun } from './aiIndexRun.model';
import { AiDocument } from './aiDocument.model';
import { AiChunk } from './aiChunk.model';
import { AiQuery } from './aiQuery.model';

// --- Organization <-> Department / Channel ---
Organization.hasMany(Department, { foreignKey: 'organizationId', as: 'departments' });
Department.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

Organization.hasMany(Channel, { foreignKey: 'organizationId', as: 'channels' });
Channel.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

// --- Department <-> User ---
Department.hasMany(User, { foreignKey: 'departmentId', as: 'users' });
User.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });

// --- Department <-> User (manager) — a relationship, not a role (see utils/constants.ts) ---
Department.belongsTo(User, { foreignKey: 'managerId', as: 'manager' });
User.hasMany(Department, { foreignKey: 'managerId', as: 'managedDepartments' });

// --- User <-> RefreshToken ---
User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens' });
RefreshToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });
RefreshToken.belongsTo(RefreshToken, { foreignKey: 'replacedByTokenId', as: 'replacedByToken' });

// --- User <-> File (avatar) ---
User.belongsTo(File, { foreignKey: 'avatarFileId', as: 'avatarFile' });
File.belongsTo(User, { foreignKey: 'uploadedById', as: 'uploadedBy' });
File.hasMany(User, { foreignKey: 'avatarFileId', as: 'avatarOwners' });

// --- Channel <-> Department (optional department-scoped channel) ---
Department.hasMany(Channel, { foreignKey: 'departmentId', as: 'channels' });
Channel.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });

// --- Channel <-> User (creator) ---
User.hasMany(Channel, { foreignKey: 'createdBy', as: 'createdChannels' });
Channel.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

// --- Channel <-> User through ChannelMember ---
Channel.belongsToMany(User, { through: ChannelMember, foreignKey: 'channelId', otherKey: 'userId', as: 'members' });
User.belongsToMany(Channel, { through: ChannelMember, foreignKey: 'userId', otherKey: 'channelId', as: 'channels' });
Channel.hasMany(ChannelMember, { foreignKey: 'channelId', as: 'channelMembers' });
ChannelMember.belongsTo(Channel, { foreignKey: 'channelId', as: 'channel' });
User.hasMany(ChannelMember, { foreignKey: 'userId', as: 'channelMemberships' });
ChannelMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
ChannelMember.belongsTo(Message, { foreignKey: 'lastReadMessageId', as: 'lastReadMessage' });

// --- Channel <-> Message ---
Channel.hasMany(Message, { foreignKey: 'channelId', as: 'messages' });
Message.belongsTo(Channel, { foreignKey: 'channelId', as: 'channel' });
User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
Message.belongsTo(Message, { foreignKey: 'replyToMessageId', as: 'replyToMessage' });
Message.hasMany(Message, { foreignKey: 'replyToMessageId', as: 'replies' });

// --- Message <-> MessageReaction ---
Message.hasMany(MessageReaction, { foreignKey: 'messageId', as: 'reactions' });
MessageReaction.belongsTo(Message, { foreignKey: 'messageId', as: 'message' });
User.hasMany(MessageReaction, { foreignKey: 'userId', as: 'messageReactions' });
MessageReaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// --- File <-> FileAttachment ---
File.hasMany(FileAttachment, { foreignKey: 'fileId', as: 'attachments' });
FileAttachment.belongsTo(File, { foreignKey: 'fileId', as: 'file' });

// --- LeaveRequest <-> User (requester + reviewer) ---
User.hasMany(LeaveRequest, { foreignKey: 'userId', as: 'leaveRequests' });
LeaveRequest.belongsTo(User, { foreignKey: 'userId', as: 'requester' });
User.hasMany(LeaveRequest, { foreignKey: 'reviewedById', as: 'reviewedLeaveRequests' });
LeaveRequest.belongsTo(User, { foreignKey: 'reviewedById', as: 'reviewer' });

// --- LeaveRequest <-> LeaveRequestReview (full audit trail, source of truth for the approval stepper) ---
LeaveRequest.hasMany(LeaveRequestReview, { foreignKey: 'leaveRequestId', as: 'reviews' });
LeaveRequestReview.belongsTo(LeaveRequest, { foreignKey: 'leaveRequestId', as: 'leaveRequest' });
User.hasMany(LeaveRequestReview, { foreignKey: 'reviewerId', as: 'leaveRequestReviews' });
LeaveRequestReview.belongsTo(User, { foreignKey: 'reviewerId', as: 'reviewer' });

// --- LeaveBalance <-> User ---
User.hasMany(LeaveBalance, { foreignKey: 'userId', as: 'leaveBalances' });
LeaveBalance.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// --- Ticket <-> User (creator + assignee) / Department ---
User.hasMany(Ticket, { foreignKey: 'createdById', as: 'createdTickets' });
Ticket.belongsTo(User, { foreignKey: 'createdById', as: 'creator' });
User.hasMany(Ticket, { foreignKey: 'assignedToId', as: 'assignedTickets' });
Ticket.belongsTo(User, { foreignKey: 'assignedToId', as: 'assignee' });
Department.hasMany(Ticket, { foreignKey: 'departmentId', as: 'tickets' });
Ticket.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });

// --- Ticket <-> TicketComment <-> User (author) ---
Ticket.hasMany(TicketComment, { foreignKey: 'ticketId', as: 'comments' });
TicketComment.belongsTo(Ticket, { foreignKey: 'ticketId', as: 'ticket' });
User.hasMany(TicketComment, { foreignKey: 'authorId', as: 'ticketComments' });
TicketComment.belongsTo(User, { foreignKey: 'authorId', as: 'author' });

// --- Meeting <-> User (organizer) / Channel / MeetingParticipant ---
User.hasMany(Meeting, { foreignKey: 'organizerId', as: 'organizedMeetings' });
Meeting.belongsTo(User, { foreignKey: 'organizerId', as: 'organizer' });
Channel.hasMany(Meeting, { foreignKey: 'channelId', as: 'meetings' });
Meeting.belongsTo(Channel, { foreignKey: 'channelId', as: 'channel' });
Meeting.hasMany(MeetingParticipant, { foreignKey: 'meetingId', as: 'participants' });
MeetingParticipant.belongsTo(Meeting, { foreignKey: 'meetingId', as: 'meeting' });
User.hasMany(MeetingParticipant, { foreignKey: 'userId', as: 'meetingParticipations' });
MeetingParticipant.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Meeting.belongsToMany(User, {
  through: MeetingParticipant,
  foreignKey: 'meetingId',
  otherKey: 'userId',
  as: 'attendees',
});
User.belongsToMany(Meeting, {
  through: MeetingParticipant,
  foreignKey: 'userId',
  otherKey: 'meetingId',
  as: 'invitedMeetings',
});

// --- Notification <-> User ---
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// --- AI RAG code assistant (Module 7) ---
User.hasMany(AiIndexRun, { foreignKey: 'startedById', as: 'startedAiIndexRuns' });
AiIndexRun.belongsTo(User, { foreignKey: 'startedById', as: 'startedBy' });

AiIndexRun.hasMany(AiDocument, { foreignKey: 'indexRunId', as: 'documents' });
AiDocument.belongsTo(AiIndexRun, { foreignKey: 'indexRunId', as: 'indexRun' });

AiIndexRun.hasMany(AiChunk, { foreignKey: 'indexRunId', as: 'chunks' });
AiChunk.belongsTo(AiIndexRun, { foreignKey: 'indexRunId', as: 'indexRun' });
AiDocument.hasMany(AiChunk, { foreignKey: 'documentId', as: 'chunks' });
AiChunk.belongsTo(AiDocument, { foreignKey: 'documentId', as: 'document' });

User.hasMany(AiQuery, { foreignKey: 'userId', as: 'aiQueries' });
AiQuery.belongsTo(User, { foreignKey: 'userId', as: 'user' });
AiQuery.belongsTo(AiQuery, { foreignKey: 'parentQueryId', as: 'parentQuery' });
AiQuery.hasMany(AiQuery, { foreignKey: 'parentQueryId', as: 'childQueries' });
Channel.hasMany(AiQuery, { foreignKey: 'channelId', as: 'aiQueries' });
AiQuery.belongsTo(Channel, { foreignKey: 'channelId', as: 'channel' });
Message.hasMany(AiQuery, { foreignKey: 'messageId', as: 'aiQueries' });
AiQuery.belongsTo(Message, { foreignKey: 'messageId', as: 'message' });
AiIndexRun.hasMany(AiQuery, { foreignKey: 'indexRunId', as: 'queries' });
AiQuery.belongsTo(AiIndexRun, { foreignKey: 'indexRunId', as: 'indexRun' });

export {
  sequelize,
  Organization,
  Department,
  User,
  RefreshToken,
  Channel,
  ChannelMember,
  Message,
  MessageReaction,
  File,
  FileAttachment,
  LeaveRequest,
  LeaveRequestReview,
  LeaveBalance,
  Ticket,
  TicketComment,
  Meeting,
  MeetingParticipant,
  Notification,
  AiIndexRun,
  AiDocument,
  AiChunk,
  AiQuery,
};
