import { ref } from 'vue';
import { defineStore } from 'pinia';

export interface PresenceEntry {
  status: 'online' | 'offline';
  lastSeenAt: string | null;
}

/**
 * Raw status map only — deliberately does NOT fetch user details per
 * presence event (CONTRACT.md §4.4 broadcasts `presence:update` to every
 * connected client with no filtering; a reconnect storm can produce a burst
 * of these, and firing a user-detail fetch per event would be a
 * request-storm risk). Components resolve a userId's display info lazily
 * against the `users` store instead.
 */
export const usePresenceStore = defineStore('presence', () => {
  const byUserId = ref<Map<string, PresenceEntry>>(new Map());

  function setPresence(userId: string, status: 'online' | 'offline', lastSeenAt: string | null): void {
    byUserId.value.set(userId, { status, lastSeenAt });
  }

  function isOnline(userId: string): boolean {
    return byUserId.value.get(userId)?.status === 'online';
  }

  function reset(): void {
    byUserId.value = new Map();
  }

  return { byUserId, setPresence, isOnline, reset };
});
