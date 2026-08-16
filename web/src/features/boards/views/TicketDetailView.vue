<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import TicketDetailPanel from '../components/TicketDetailPanel.vue';

/** Rendered into the `aside` named view for /boards/ticket/:ticketId (router/index.ts) — same pattern as chat's ThreadView.vue. The `default` view for this route is still KanbanBoardView, so the board stays visible alongside the ticket detail. */
const route = useRoute();
const router = useRouter();

const ticketId = computed(() => (typeof route.params.ticketId === 'string' ? route.params.ticketId : ''));

function onClose(): void {
  void router.push({ name: 'boards' });
}
</script>

<template>
  <TicketDetailPanel v-if="ticketId" :ticket-id="ticketId" @close="onClose" />
</template>
