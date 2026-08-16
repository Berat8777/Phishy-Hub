import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import * as channelsApi from '../api/endpoints/channels';
import { emitMessageRead } from '../socket/emit';
import { createLimiter } from '../lib/concurrency';
import type { ChannelListItemDTO, ChannelMemberDTO, ChannelType } from '../api/types';

/** DM channels have no `name` server-side — the sidebar composes a label from member names instead, batched so a workspace with many DMs doesn't fire unlimited parallel member-list requests. */
const MAX_CONCURRENT_MEMBER_FETCHES = 6;

export const useChannelsStore = defineStore('channels', () => {
  const byId = ref<Map<string, ChannelListItemDTO>>(new Map());
  const activeChannelId = ref<string | null>(null);
  const loading = ref(false);
  const loaded = ref(false);
  const membersByChannel = ref<Map<string, ChannelMemberDTO[]>>(new Map());
  const memberFetchLimiter = createLimiter(MAX_CONCURRENT_MEMBER_FETCHES);
  const memberFetchInflight = new Map<string, Promise<ChannelMemberDTO[]>>();

  const channelList = computed(() =>
    Array.from(byId.value.values()).sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ?? a.createdAt;
      const bTime = b.lastMessage?.createdAt ?? b.createdAt;
      return bTime.localeCompare(aTime);
    }),
  );

  const activeChannel = computed(() => (activeChannelId.value ? byId.value.get(activeChannelId.value) ?? null : null));

  const totalUnreadCount = computed(() =>
    Array.from(byId.value.values()).reduce((sum, channel) => sum + channel.unreadCount, 0),
  );

  async function fetchChannels(params?: { type?: ChannelType }): Promise<void> {
    loading.value = true;
    try {
      const { items } = await channelsApi.listChannels(params);
      for (const channel of items) {
        byId.value.set(channel.id, channel);
      }
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  function setActiveChannel(channelId: string | null): void {
    activeChannelId.value = channelId;
  }

  function upsertChannel(channel: ChannelListItemDTO): void {
    byId.value.set(channel.id, channel);
  }

  function getChannel(channelId: string): ChannelListItemDTO | undefined {
    return byId.value.get(channelId);
  }

  function getMembers(channelId: string): ChannelMemberDTO[] | undefined {
    return membersByChannel.value.get(channelId);
  }

  /**
   * Memoized + concurrency-limited (max `MAX_CONCURRENT_MEMBER_FETCHES` in
   * flight across the whole app). `GET /channels` doesn't embed member data
   * (CONTRACT.md §3.5 — the list DTO only adds `unreadCount`/
   * `lastReadMessageId`/`lastMessage`), so DM labels need this separate
   * per-channel call; batching keeps a sidebar with many DMs from firing an
   * unbounded burst of requests on load.
   */
  function fetchMembers(channelId: string): Promise<ChannelMemberDTO[]> {
    const cached = membersByChannel.value.get(channelId);
    if (cached) return Promise.resolve(cached);
    const inflight = memberFetchInflight.get(channelId);
    if (inflight) return inflight;

    const promise = memberFetchLimiter(() => channelsApi.listMembers(channelId))
      .then((members) => {
        membersByChannel.value.set(channelId, members);
        return members;
      })
      .finally(() => {
        memberFetchInflight.delete(channelId);
      });
    memberFetchInflight.set(channelId, promise);
    return promise;
  }

  /**
   * `POST /channels/:id/members` — server-side authorization is
   * `assertChannelAdmin` (channel.service.ts::addMember): the actor must be
   * either a global `admin` or hold `channelRole: 'admin'` on this channel
   * themselves. Appends the resulting membership to the cached list so
   * ChannelInfoPanel.vue reflects it immediately without a refetch.
   */
  async function addMember(channelId: string, userId: string): Promise<ChannelMemberDTO> {
    const membership = await channelsApi.addMember(channelId, userId);
    const list = membersByChannel.value.get(channelId) ?? [];
    if (!list.some((m) => m.userId === userId)) {
      membersByChannel.value.set(channelId, [...list, membership]);
    }
    return membership;
  }

  /**
   * `DELETE /channels/:id/members/:userId` — same `assertChannelAdmin`
   * authorization as `addMember` above. Removes the member from the cached
   * list immediately so ChannelInfoPanel.vue reflects it without a
   * refetch.
   */
  async function removeMember(channelId: string, userId: string): Promise<void> {
    await channelsApi.removeMember(channelId, userId);
    const list = membersByChannel.value.get(channelId);
    if (list) {
      membersByChannel.value.set(channelId, list.filter((m) => m.userId !== userId));
    }
  }

  /**
   * Marks a channel read up to `lastReadMessageId` — emits `message:read`
   * (CONTRACT.md §4.2) and relies on the resulting `message:read` broadcast
   * (which the server sends to the whole room, sender included per §4.3) to
   * come back through eventBridge.ts -> applyReadReceipt below rather than
   * updating optimistically here, so a failed/dropped emit doesn't leave the
   * badge showing "read" when the server never recorded it.
   */
  async function markRead(channelId: string, lastReadMessageId: string): Promise<void> {
    await emitMessageRead({ channelId, lastReadMessageId });
  }

  /** Bumps a channel's preview/unread badge when a new top-level message arrives via the socket. */
  function applyIncomingMessagePreview(input: {
    channelId: string;
    message: { id: string; body: string | null; senderId: string; createdAt: string };
    isOwnMessage: boolean;
  }): void {
    const channel = byId.value.get(input.channelId);
    if (!channel) return;
    channel.lastMessage = input.message;
    if (!input.isOwnMessage && input.channelId !== activeChannelId.value) {
      channel.unreadCount += 1;
    }
  }

  /** Reflects a `message:read` event for the current user back into the unread badge. */
  function applyReadReceipt(channelId: string, lastReadMessageId: string): void {
    const channel = byId.value.get(channelId);
    if (!channel) return;
    channel.lastReadMessageId = lastReadMessageId;
    channel.unreadCount = 0;
  }

  function reset(): void {
    byId.value = new Map();
    activeChannelId.value = null;
    loading.value = false;
    loaded.value = false;
    membersByChannel.value = new Map();
    memberFetchInflight.clear();
  }

  return {
    byId,
    activeChannelId,
    loading,
    loaded,
    channelList,
    activeChannel,
    totalUnreadCount,
    fetchChannels,
    setActiveChannel,
    upsertChannel,
    getChannel,
    getMembers,
    fetchMembers,
    addMember,
    removeMember,
    markRead,
    applyIncomingMessagePreview,
    applyReadReceipt,
    reset,
  };
});
