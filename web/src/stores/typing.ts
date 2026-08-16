import { ref } from 'vue';
import { defineStore } from 'pinia';

/** How long a `typing:start` stays "active" without a follow-up before it auto-expires. */
const TYPING_TIMEOUT_MS = 5_000;

interface TypingTimer {
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Per-channel, per-user typing indicator state. The server relays
 * `typing:start`/`typing:stop` verbatim with no server-side timeout
 * (CONTRACT.md §4.2/§4.3) — if a `typing:stop` is ever dropped (tab closed,
 * network blip), "X is typing" would otherwise stay stuck forever. Every
 * `typing:start` here (re)schedules a client-side timer that clears the
 * entry after TYPING_TIMEOUT_MS.
 */
export const useTypingStore = defineStore('typing', () => {
  const byChannel = ref<Map<string, Map<string, TypingTimer>>>(new Map());

  function setTyping(channelId: string, userId: string, isTyping: boolean): void {
    const channelMap = byChannel.value.get(channelId) ?? new Map<string, TypingTimer>();

    const existing = channelMap.get(userId);
    if (existing) clearTimeout(existing.timer);

    if (!isTyping) {
      channelMap.delete(userId);
      byChannel.value.set(channelId, channelMap);
      return;
    }

    const timer = setTimeout(() => {
      const current = byChannel.value.get(channelId);
      current?.delete(userId);
      if (current) byChannel.value.set(channelId, new Map(current));
    }, TYPING_TIMEOUT_MS);

    channelMap.set(userId, { timer });
    byChannel.value.set(channelId, new Map(channelMap));
  }

  function typingUserIds(channelId: string): string[] {
    return Array.from(byChannel.value.get(channelId)?.keys() ?? []);
  }

  /** Called after a reconnect (socket/eventBridge.ts) — timers from before the disconnect are meaningless once the socket drops. */
  function reset(): void {
    for (const channelMap of byChannel.value.values()) {
      for (const entry of channelMap.values()) clearTimeout(entry.timer);
    }
    byChannel.value = new Map();
  }

  return { byChannel, setTyping, typingUserIds, reset };
});
