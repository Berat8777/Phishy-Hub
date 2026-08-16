import { computed, onMounted, watch } from 'vue';
import { useChannelsStore } from '../../../stores/channels';
import { useUsersStore } from '../../../stores/users';
import { useAuthStore } from '../../../stores/auth';
import type { ChannelDTO } from '../../../api/types';

/**
 * DM channels have `name: null` server-side (CONTRACT.md §3.5) — this
 * resolves a display label from the other member(s)' names instead, since
 * the channel-list DTO doesn't embed member data (a separate
 * `GET /channels/:id/members` call is needed, batched/memoized in
 * `channels` store's `fetchMembers`). Shared by ChannelListItem.vue (sidebar
 * row) and ChatView.vue (channel header) so the two never drift.
 *
 * Takes a getter (not a `Ref`) so callers can pass a narrower DTO subtype
 * (e.g. `ChannelListItemDTO`) without fighting `Ref<T>`'s invariance.
 */
export function useChannelLabel(getChannel: () => ChannelDTO | null | undefined) {
  const channelsStore = useChannelsStore();
  const usersStore = useUsersStore();
  const authStore = useAuthStore();

  async function ensureDmData(): Promise<void> {
    const c = getChannel();
    if (!c || c.type !== 'dm' || c.name) return;
    try {
      const members = await channelsStore.fetchMembers(c.id);
      await Promise.all(
        members
          .filter((m) => m.userId !== authStore.user?.id)
          .map((m) => usersStore.fetchUser(m.userId).catch(() => undefined)),
      );
    } catch {
      // Falls back to "Direct message" below.
    }
  }

  onMounted(ensureDmData);
  watch(() => getChannel()?.id, ensureDmData);

  const otherMemberIds = computed(() => {
    const c = getChannel();
    if (!c || c.type !== 'dm') return [];
    const members = channelsStore.getMembers(c.id);
    if (!members) return [];
    return members.map((m) => m.userId).filter((id) => id !== authStore.user?.id);
  });

  const label = computed(() => {
    const c = getChannel();
    if (!c) return '';
    if (c.name) return c.name;
    if (c.type !== 'dm') return 'Untitled channel';
    const names = otherMemberIds.value
      .map((id) => usersStore.getUser(id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => `${u.firstName} ${u.lastName}`);
    return names.length ? names.join(', ') : 'Direct message';
  });

  return { label, otherMemberIds };
}
