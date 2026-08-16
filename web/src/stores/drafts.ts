import { ref } from 'vue';
import { defineStore } from 'pinia';

/** Thinner for this pass — per-channel composer draft text, not yet wired to any composer UI. */
export const useDraftsStore = defineStore('drafts', () => {
  const byChannel = ref<Map<string, string>>(new Map());

  function setDraft(channelId: string, text: string): void {
    if (text) byChannel.value.set(channelId, text);
    else byChannel.value.delete(channelId);
  }

  function getDraft(channelId: string): string {
    return byChannel.value.get(channelId) ?? '';
  }

  function clearDraft(channelId: string): void {
    byChannel.value.delete(channelId);
  }

  function reset(): void {
    byChannel.value = new Map();
  }

  return { byChannel, setDraft, getDraft, clearDraft, reset };
});
