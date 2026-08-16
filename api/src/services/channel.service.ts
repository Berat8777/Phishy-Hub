import { QueryTypes } from 'sequelize';
import { sequelize, Channel, ChannelMember, User } from '../models';
import { getDefaultOrganizationId } from './auth.service';
import { assertChannelAdmin, assertChannelMember } from './authz.service';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import { paginate, PaginationParams } from './pagination.service';
import type { ChannelType } from '../utils/constants';

export interface ChannelListItemDTO extends Record<string, unknown> {
  unreadCount: number;
  lastReadMessageId: string | null;
  lastMessage: { id: string; body: string | null; senderId: string; createdAt: string } | null;
}

async function getChannelOrThrow(channelId: string): Promise<InstanceType<typeof Channel>> {
  const channel = await Channel.findByPk(channelId);
  if (!channel) throw new NotFoundError('Channel not found');
  return channel;
}

export async function listMyChannels(userId: string, params: PaginationParams & { type?: ChannelType }) {
  return paginate(
    Channel,
    params,
    {
      include: [{ model: ChannelMember, as: 'channelMembers', where: { userId }, attributes: [] }],
      where: params.type ? { type: params.type } : undefined,
    },
    'createdAt',
  );
}

interface UnreadCountRow {
  channel_id: string;
  unread_count: string | number;
}

interface LastMessageRow {
  id: string;
  channel_id: string;
  body: string | null;
  sender_id: string;
  created_at: string | Date;
}

/**
 * Adds `unreadCount`/`lastReadMessageId`/`lastMessage` to each channel in a
 * page of `listMyChannels()` results. Both aggregates are computed with one
 * query for the whole page (not one query per channel) — a raw query is
 * needed because each channel's "unread" threshold is a different
 * `lastReadMessageId`, and "most recent message per channel" needs
 * `DISTINCT ON`, neither of which `pagination.service.ts::paginate()` (built
 * for a single model's own attributes) or a plain Sequelize finder
 * expresses directly.
 *
 * Both aggregates only consider top-level messages (`reply_to_message_id IS
 * NULL`), matching the channel timeline after thread replies were excluded
 * from it (see message.service.ts::listMessages) — a reply landing in a
 * thread shouldn't bump the channel's unread badge or preview.
 */
export async function attachChannelListMeta(
  userId: string,
  channels: InstanceType<typeof Channel>[],
): Promise<ChannelListItemDTO[]> {
  if (channels.length === 0) return [];
  const channelIds = channels.map((c) => c.id);

  const memberships = await ChannelMember.findAll({
    where: { channelId: channelIds, userId },
    attributes: ['channelId', 'lastReadMessageId'],
  });
  const lastReadByChannel = new Map(memberships.map((m) => [m.channelId, m.lastReadMessageId]));

  const unreadRows = await sequelize.query<UnreadCountRow>(
    `
    SELECT m.channel_id AS channel_id, COUNT(*) AS unread_count
    FROM messages m
    JOIN channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = :userId
    LEFT JOIN messages anchor ON anchor.id = cm.last_read_message_id
    WHERE m.channel_id IN (:channelIds)
      AND m.sender_id != :userId
      AND m.deleted_at IS NULL
      AND m.reply_to_message_id IS NULL
      AND (
        cm.last_read_message_id IS NULL
        OR m.created_at > anchor.created_at
        OR (m.created_at = anchor.created_at AND m.id > anchor.id)
      )
    GROUP BY m.channel_id
    `,
    { replacements: { userId, channelIds }, type: QueryTypes.SELECT },
  );
  const unreadByChannel = new Map(unreadRows.map((r) => [r.channel_id, Number(r.unread_count)]));

  const lastMessageRows = await sequelize.query<LastMessageRow>(
    `
    SELECT DISTINCT ON (channel_id) id, channel_id, body, sender_id, created_at
    FROM messages
    WHERE channel_id IN (:channelIds) AND deleted_at IS NULL AND reply_to_message_id IS NULL
    ORDER BY channel_id, created_at DESC, id DESC
    `,
    { replacements: { channelIds }, type: QueryTypes.SELECT },
  );
  const lastMessageByChannel = new Map(lastMessageRows.map((r) => [r.channel_id, r]));

  return channels.map((channel) => {
    const json = channel.toJSON() as Record<string, unknown>;
    const lastMessageRow = lastMessageByChannel.get(channel.id);
    return {
      ...json,
      unreadCount: unreadByChannel.get(channel.id) ?? 0,
      lastReadMessageId: lastReadByChannel.get(channel.id) ?? null,
      lastMessage: lastMessageRow
        ? {
            id: lastMessageRow.id,
            body: lastMessageRow.body,
            senderId: lastMessageRow.sender_id,
            createdAt: new Date(lastMessageRow.created_at).toISOString(),
          }
        : null,
    } as ChannelListItemDTO;
  });
}

export async function getChannel(userId: string, channelId: string): Promise<InstanceType<typeof Channel>> {
  const channel = await getChannelOrThrow(channelId);
  await assertChannelMember(userId, channelId);
  return channel;
}

export async function listMembers(userId: string, channelId: string) {
  await assertChannelMember(userId, channelId);
  return ChannelMember.findAll({
    where: { channelId },
    include: [{ model: User, as: 'user' }],
    order: [['joinedAt', 'ASC']],
  });
}

/**
 * Creates a channel. For `type: 'dm'`, `memberIds` may hold 2+ other users
 * (group DM — architecture doc's open question #3: group DM is in scope,
 * modeled as an ordinary `dm` channel with >2 members instead of a
 * separate type).
 */
export async function createChannel(
  creatorId: string,
  input: { name?: string | null; type: ChannelType; departmentId?: string | null; memberIds?: string[] },
): Promise<InstanceType<typeof Channel>> {
  if (input.type !== 'dm' && (!input.name || !input.name.trim())) {
    throw new BadRequestError('name is required for public/private channels');
  }

  const memberIds = new Set([creatorId, ...(input.memberIds ?? [])]);

  if (input.memberIds && input.memberIds.length > 0) {
    const existingCount = await User.count({ where: { id: Array.from(memberIds) } });
    if (existingCount !== memberIds.size) {
      throw new BadRequestError('memberIds contains a user id that does not exist');
    }
  }

  const organizationId = await getDefaultOrganizationId();

  // Channel + its initial ChannelMember rows must land together — if the
  // bulkCreate below failed after the channel row committed, callers would
  // be left with a channel no one (not even its creator) can see or use.
  return sequelize.transaction(async (transaction) => {
    const channel = await Channel.create(
      {
        organizationId,
        name: input.name?.trim() || null,
        type: input.type,
        departmentId: input.departmentId ?? null,
        createdBy: creatorId,
        isArchived: false,
      },
      { transaction },
    );

    await ChannelMember.bulkCreate(
      Array.from(memberIds).map((userId) => ({
        channelId: channel.id,
        userId,
        channelRole: userId === creatorId ? ('admin' as const) : ('member' as const),
        joinedAt: new Date(),
      })),
      { transaction },
    );

    return channel;
  });
}

export async function joinChannel(userId: string, channelId: string): Promise<InstanceType<typeof ChannelMember>> {
  const channel = await getChannelOrThrow(channelId);
  if (channel.type !== 'public') {
    throw new BadRequestError('Only public channels can be joined directly; ask a channel admin to add you');
  }
  const existing = await ChannelMember.findOne({ where: { channelId, userId } });
  if (existing) throw new ConflictError('Already a member of this channel');
  return ChannelMember.create({ channelId, userId, channelRole: 'member', joinedAt: new Date() });
}

export async function leaveChannel(userId: string, channelId: string): Promise<void> {
  const membership = await assertChannelMember(userId, channelId);
  await membership.destroy();
}

export async function addMember(
  actorId: string,
  actorRole: string,
  channelId: string,
  targetUserId: string,
): Promise<InstanceType<typeof ChannelMember>> {
  await getChannelOrThrow(channelId);
  await assertChannelAdmin(actorId, actorRole as never, channelId);
  const existing = await ChannelMember.findOne({ where: { channelId, userId: targetUserId } });
  if (existing) throw new ConflictError('User is already a member of this channel');
  return ChannelMember.create({ channelId, userId: targetUserId, channelRole: 'member', joinedAt: new Date() });
}

export async function removeMember(
  actorId: string,
  actorRole: string,
  channelId: string,
  targetUserId: string,
): Promise<void> {
  await getChannelOrThrow(channelId);
  await assertChannelAdmin(actorId, actorRole as never, channelId);
  const membership = await ChannelMember.findOne({ where: { channelId, userId: targetUserId } });
  if (!membership) throw new NotFoundError('That user is not a member of this channel');
  await membership.destroy();
}

export async function archiveChannel(actorId: string, actorRole: string, channelId: string): Promise<InstanceType<typeof Channel>> {
  const channel = await getChannelOrThrow(channelId);
  await assertChannelAdmin(actorId, actorRole as never, channelId);
  channel.isArchived = true;
  await channel.save();
  return channel;
}

/**
 * Finds an existing DM/group-DM channel with exactly this set of members,
 * if one exists — best-effort de-dup (architecture doc §7 accepts DM
 * duplication as a low-priority race-condition risk, not fully solved).
 */
export async function findExistingDmChannel(memberIds: string[]): Promise<InstanceType<typeof Channel> | null> {
  const sorted = [...memberIds].sort();
  const candidates = await Channel.findAll({
    where: { type: 'dm' },
    include: [{ model: ChannelMember, as: 'channelMembers', attributes: ['userId'] }],
  });
  for (const candidate of candidates) {
    const memberIdsOfCandidate = (candidate.get('channelMembers') as InstanceType<typeof ChannelMember>[])
      .map((m) => m.userId)
      .sort();
    if (
      memberIdsOfCandidate.length === sorted.length &&
      memberIdsOfCandidate.every((id, idx) => id === sorted[idx])
    ) {
      return candidate;
    }
  }
  return null;
}

/**
 * `POST /channels/dm` — get-or-create. Routes `findExistingDmChannel` (which
 * previously existed but had no REST endpoint, architecture doc §7 "DM
 * channel de-duplication" risk) so callers no longer need their own
 * best-effort "does this DM already exist" check client-side.
 */
export async function getOrCreateDmChannel(
  callerId: string,
  userIds: string[],
): Promise<{ channel: InstanceType<typeof Channel>; created: boolean }> {
  if (!userIds || userIds.length === 0) {
    throw new BadRequestError('userIds must include at least one other user');
  }

  const memberIds = Array.from(new Set([callerId, ...userIds]));
  if (memberIds.length < 2) {
    throw new BadRequestError('A DM channel requires at least 2 distinct members');
  }

  const existingCount = await User.count({ where: { id: memberIds } });
  if (existingCount !== memberIds.length) {
    throw new BadRequestError('userIds contains a user id that does not exist');
  }

  const existing = await findExistingDmChannel(memberIds);
  if (existing) return { channel: existing, created: false };

  const channel = await createChannel(callerId, { type: 'dm', memberIds: userIds });
  return { channel, created: true };
}
