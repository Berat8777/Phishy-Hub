import { Op } from 'sequelize';
import { sequelize, Meeting, MeetingParticipant, User } from '../models';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { paginate, PaginationParams } from './pagination.service';
import { createNotification } from './notification.service';
import type { RsvpStatus } from '../utils/constants';

const MEETING_INCLUDE = [
  { model: User, as: 'organizer', attributes: ['id', 'firstName', 'lastName', 'email'] },
  {
    model: MeetingParticipant,
    as: 'participants',
    include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }],
  },
];

async function getOrThrow(id: string): Promise<InstanceType<typeof Meeting>> {
  const meeting = await Meeting.findByPk(id, { include: MEETING_INCLUDE });
  if (!meeting) throw new NotFoundError('Meeting not found');
  return meeting;
}

export async function createMeeting(
  organizerId: string,
  input: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    location?: string;
    channelId?: string | null;
    participantIds?: string[];
  },
): Promise<InstanceType<typeof Meeting>> {
  if (new Date(input.endTime) <= new Date(input.startTime)) {
    throw new BadRequestError('endTime must be after startTime');
  }

  const participantIds = new Set([organizerId, ...(input.participantIds ?? [])]);

  if (input.participantIds && input.participantIds.length > 0) {
    const existingCount = await User.count({ where: { id: Array.from(participantIds) } });
    if (existingCount !== participantIds.size) {
      throw new BadRequestError('participantIds contains a user id that does not exist');
    }
  }

  // Meeting + its initial MeetingParticipant rows must land together — a
  // meeting row that survives without any participants (including its own
  // organizer) is orphaned/unusable.
  const meeting = await sequelize.transaction(async (transaction) => {
    const created = await Meeting.create(
      {
        title: input.title.trim(),
        description: input.description ?? null,
        organizerId,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        location: input.location ?? null,
        channelId: input.channelId ?? null,
      },
      { transaction },
    );

    await MeetingParticipant.bulkCreate(
      Array.from(participantIds).map((userId) => ({
        meetingId: created.id,
        userId,
        rsvpStatus: userId === organizerId ? ('accepted' as const) : ('invited' as const),
      })),
      { transaction },
    );

    return created;
  });

  for (const userId of participantIds) {
    if (userId === organizerId) continue;
    await createNotification(userId, 'meeting_invite', { meetingId: meeting.id, title: meeting.title });
  }

  return getOrThrow(meeting.id);
}

export async function listMeetings(
  userId: string,
  params: PaginationParams & { from?: string; to?: string },
) {
  const where: Record<string, unknown> = {};
  if (params.from || params.to) {
    const range: Record<symbol, Date> = {};
    if (params.from) range[Op.gte] = new Date(params.from);
    if (params.to) range[Op.lte] = new Date(params.to);
    where.startTime = range;
  }

  return paginate(
    Meeting,
    params,
    {
      include: [
        ...MEETING_INCLUDE,
        { model: MeetingParticipant, as: 'participants', attributes: [], where: { userId }, required: true },
      ],
    },
    'startTime',
  );
}

export async function getMeetingById(id: string): Promise<InstanceType<typeof Meeting>> {
  return getOrThrow(id);
}

export async function respondToMeeting(
  userId: string,
  id: string,
  rsvpStatus: RsvpStatus,
): Promise<InstanceType<typeof Meeting>> {
  const participant = await MeetingParticipant.findOne({ where: { meetingId: id, userId } });
  if (!participant) throw new ForbiddenError('You are not invited to this meeting');
  participant.rsvpStatus = rsvpStatus;
  await participant.save();
  return getOrThrow(id);
}
