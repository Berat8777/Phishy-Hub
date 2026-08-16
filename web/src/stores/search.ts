import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as messagesApi from '../api/endpoints/messages';
import type { MessageDTO } from '../api/types';

export const useSearchStore = defineStore('search', () => {
  const query = ref('');
  const results = ref<MessageDTO[]>([]);
  const loading = ref(false);
  /** Set by SearchPanel on a result click, consumed by ChatView: "navigate to the channel and scroll to/highlight that message" — MessageList itself doesn't know about search, so this is the hand-off point. */
  const scrollTarget = ref<{ channelId: string; messageId: string } | null>(null);

  function requestScrollTo(channelId: string, messageId: string): void {
    scrollTarget.value = { channelId, messageId };
  }

  function consumeScrollTarget(): { channelId: string; messageId: string } | null {
    const target = scrollTarget.value;
    scrollTarget.value = null;
    return target;
  }

  async function search(q: string, channelId?: string): Promise<void> {
    query.value = q;
    if (!q) {
      results.value = [];
      return;
    }
    loading.value = true;
    try {
      const { items } = await messagesApi.searchMessages({ q, channelId });
      results.value = items;
    } finally {
      loading.value = false;
    }
  }

  function reset(): void {
    query.value = '';
    results.value = [];
    loading.value = false;
    scrollTarget.value = null;
  }

  return { query, results, loading, scrollTarget, requestScrollTo, consumeScrollTarget, search, reset };
});
