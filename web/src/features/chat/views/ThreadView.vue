<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ThreadPanel from '../components/thread/ThreadPanel.vue';

/** Rendered into the `aside` named view for /chat/:channelId/thread/:messageId (router/index.ts) — the `default` view for this route is still ChatView, so the channel's own timeline stays visible alongside the thread. */
const route = useRoute();
const router = useRouter();

const channelId = computed(() => (typeof route.params.channelId === 'string' ? route.params.channelId : ''));
const messageId = computed(() => (typeof route.params.messageId === 'string' ? route.params.messageId : ''));

function onClose(): void {
  void router.push({ name: 'chat', params: { channelId: channelId.value } });
}
</script>

<template>
  <ThreadPanel v-if="channelId && messageId" :channel-id="channelId" :root-message-id="messageId" @close="onClose" />
</template>
