<script setup lang="ts">
import { PhIcon } from '@phishyhub/design-system';
import UserAvatar from '../../../components/shared/UserAvatar.vue';
import PriorityBadge from './PriorityBadge.vue';
import { formatRelative } from '../../../lib/date';
import type { TicketDTO } from '../../../api/types';

defineProps<{ ticket: TicketDTO }>();
const emit = defineEmits<{ open: [] }>();
</script>

<template>
  <button type="button" class="ticket-card" @click="emit('open')">
    <div class="ticket-card__header">
      <PriorityBadge :priority="ticket.priority" />
      <span v-if="ticket.department" class="ticket-card__department">{{ ticket.department.name }}</span>
    </div>
    <p class="ticket-card__title">{{ ticket.title }}</p>
    <div class="ticket-card__footer">
      <span class="ticket-card__time">{{ formatRelative(ticket.createdAt) }}</span>
      <UserAvatar v-if="ticket.assignedToId" :user-id="ticket.assignedToId" size="xs" />
      <span v-else class="ticket-card__unassigned" aria-label="Unassigned">
        <PhIcon name="UserPlus" size="xs" />
      </span>
    </div>
  </button>
</template>

<style scoped>
.ticket-card {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-2);
  width: 100%;
  text-align: left;
  color: inherit;
}

.ticket-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ph-space-2);
}

.ticket-card__department {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-card__title {
  margin: 0;
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-medium);
  color: var(--ph-color-text-default);
  overflow-wrap: break-word;
}

.ticket-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ph-space-2);
}

.ticket-card__time {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
}

.ticket-card__unassigned {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--ph-radius-full);
  border: 1px dashed var(--ph-color-border-strong);
  color: var(--ph-color-text-subtle);
}
</style>
