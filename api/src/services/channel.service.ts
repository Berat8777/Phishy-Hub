import { sequelize, Channel, ChannelMember, User } from '../models';
import { getDefaultOrganizationId } from './auth.service';
import { assertChannelAdmin, assertChannelMember } from './authz.service';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import { paginate, PaginationParams } from './pagination.service';
import type { ChannelType } from '../utils/constants';

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
