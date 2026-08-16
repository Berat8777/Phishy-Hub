<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { PhButton, PhIcon } from '@phishyhub/design-system';
import BoardFilterBar from '../components/BoardFilterBar.vue';
import TicketCreateDialog from '../components/TicketCreateDialog.vue';

const router = useRouter();
const createOpen = ref(false);

function onCreated(ticketId: string): void {
  void router.push({ name: 'boards-ticket', params: { ticketId } });
}
</script>

<template>
  <div class="boards-sidebar">
    <div class="boards-sidebar__header">
      <h2 class="boards-sidebar__title">Boards</h2>
      <PhButton size="sm" @click="createOpen = true">
        <PhIcon name="Plus" size="sm" /> New ticket
      </PhButton>
    </div>

    <BoardFilterBar />

    <TicketCreateDialog v-model="createOpen" @created="onCreated" />
  </div>
</template>

<style scoped>
.boards-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.boards-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ph-space-2);
  padding: var(--ph-space-4) var(--ph-space-4) var(--ph-space-2);
}

.boards-sidebar__title {
  margin: 0;
  font-size: var(--ph-font-size-md);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}
</style>
