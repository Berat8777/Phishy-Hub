<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { PhBoard, PhBoardCard, PhBoardColumn, PhSpinner } from '@phishyhub/design-system';
import type { PhBoardMovePayload } from '@phishyhub/design-system';
import { useTicketsStore } from '../stores/tickets';
import { useAuthStore } from '../../../stores/auth';
import { canCloseTicket } from '../../../lib/permissions';
import { TICKET_STATUS_META, TICKET_STATUS_ORDER } from '../components/BoardColumnHeader.vue';
import TicketCard from '../components/TicketCard.vue';
import type { TicketDTO, TicketStatus } from '../../../api/types';

const router = useRouter();
const ticketsStore = useTicketsStore();
const authStore = useAuthStore();

onMounted(() => {
  void ticketsStore.fetchAllColumns();
});

/**
 * Any ticket may move freely between every column EXCEPT `closed` — that
 * one is gated by `assertCanCloseTicket` server-side (assignee or global
 * admin only, CONTRACT.md §1.4), mirrored here via permissions.ts's
 * `canCloseTicket` so `PhBoardColumn`'s reject overlay shows before the
 * user even drops.
 */
function canDropInColumn(toStatus: TicketStatus): (itemId: string) => boolean {
  return (itemId: string): boolean => {
    if (toStatus !== 'closed') return true;
    const ticket = ticketsStore.getTicket(itemId);
    if (!ticket) return false;
    return canCloseTicket(authStore.user, ticket);
  };
}

function onItemMove(payload: PhBoardMovePayload): void {
  void ticketsStore.moveTicket(payload.itemId, payload.toColumnId as TicketStatus);
}

function openTicket(ticket: TicketDTO): void {
  void router.push({ name: 'boards-ticket', params: { ticketId: ticket.id } });
}
</script>

<template>
  <div class="kanban-board-view">
    <PhBoard @item-move="onItemMove">
      <PhBoardColumn
        v-for="status in TICKET_STATUS_ORDER"
        :key="status"
        :column-id="status"
        :title="TICKET_STATUS_META[status].label"
        :count="ticketsStore.getTotal(status)"
        :can-drop="canDropInColumn(status)"
      >
        <PhSpinner
          v-if="ticketsStore.isLoading(status) && ticketsStore.getColumn(status).length === 0"
          class="kanban-board-view__column-loading"
          size="sm"
        />
        <PhBoardCard v-for="ticket in ticketsStore.getColumn(status)" :key="ticket.id" :item-id="ticket.id">
          <TicketCard :ticket="ticket" @open="openTicket(ticket)" />
        </PhBoardCard>
      </PhBoardColumn>
    </PhBoard>
  </div>
</template>

<style scoped>
.kanban-board-view {
  height: 100%;
  padding: var(--ph-space-4);
  overflow: auto;
}

.kanban-board-view__column-loading {
  display: block;
  margin: var(--ph-space-4) auto;
}
</style>
