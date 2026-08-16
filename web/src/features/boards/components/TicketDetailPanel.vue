<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { PhIcon, PhSpinner, useToast } from '@phishyhub/design-system';
import { useTicketsStore } from '../stores/tickets';
import { useTicketCommentsStore } from '../stores/ticketComments';
import { useAuthStore } from '../../../stores/auth';
import { canCloseTicket, canDeleteTicket } from '../../../lib/permissions';
import * as ticketsApi from '../../../api/endpoints/tickets';
import { isApiError } from '../../../api/errors';
import PriorityBadge from './PriorityBadge.vue';
import TicketStatusSelect from './TicketStatusSelect.vue';
import AssigneePicker from './AssigneePicker.vue';
import TicketCommentList from './TicketCommentList.vue';
import TicketCommentComposer from './TicketCommentComposer.vue';
import type { TicketStatus } from '../../../api/types';

/** Structurally mirrors `ThreadPanel.vue`: fetch-on-mount, close button, reused for both the standalone "aside" route rendering and any future embedded use. */
const props = defineProps<{ ticketId: string }>();
const emit = defineEmits<{ close: [] }>();

const ticketsStore = useTicketsStore();
const commentsStore = useTicketCommentsStore();
const authStore = useAuthStore();
const toast = useToast();

const loading = ref(false);
const notFound = ref(false);

const ticket = computed(() => ticketsStore.getTicket(props.ticketId));

async function ensureTicket(): Promise<void> {
  notFound.value = false;
  if (ticketsStore.getTicket(props.ticketId)) return;
  loading.value = true;
  try {
    const fetched = await ticketsApi.getTicket(props.ticketId);
    ticketsStore.applyTicketUpserted(fetched);
  } catch {
    notFound.value = true;
  } finally {
    loading.value = false;
  }
}

async function loadAll(): Promise<void> {
  await ensureTicket();
  // Skip the comments fetch entirely for a ticket id that doesn't resolve
  // (bogus/stale route param) — otherwise this throws an unhandled
  // rejection (422/404) that serves no purpose once `notFound` already
  // renders the "Ticket not found" state below.
  if (notFound.value) return;
  try {
    await commentsStore.fetchComments(props.ticketId);
  } catch {
    // Best-effort — the ticket itself still renders even if comments fail to load.
  }
}

onMounted(loadAll);
watch(() => props.ticketId, loadAll);

async function onStatusChange(status: TicketStatus): Promise<void> {
  await ticketsStore.moveTicket(props.ticketId, status);
}

async function onAssign(userId: string | null): Promise<void> {
  try {
    await ticketsStore.assignTicket(props.ticketId, userId);
  } catch (err) {
    toast.push({
      title: 'Could not assign ticket',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  }
}

async function onDelete(): Promise<void> {
  try {
    await ticketsStore.deleteTicket(props.ticketId);
    emit('close');
  } catch (err) {
    toast.push({
      title: 'Could not delete ticket',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  }
}
</script>

<template>
  <div class="ticket-detail-panel">
    <header class="ticket-detail-panel__header">
      <h2 class="ticket-detail-panel__title-heading"><PhIcon name="Ticket" size="sm" /> Ticket</h2>
      <button type="button" class="ticket-detail-panel__close" aria-label="Close ticket" @click="emit('close')">
        <PhIcon name="X" size="sm" />
      </button>
    </header>

    <PhSpinner v-if="loading" class="ticket-detail-panel__loading" />

    <template v-else-if="ticket">
      <div class="ticket-detail-panel__body">
        <p class="ticket-detail-panel__title">{{ ticket.title }}</p>

        <div class="ticket-detail-panel__meta">
          <PriorityBadge :priority="ticket.priority" />
          <span v-if="ticket.department" class="ticket-detail-panel__department">{{ ticket.department.name }}</span>
        </div>

        <p v-if="ticket.description" class="ticket-detail-panel__description">{{ ticket.description }}</p>

        <div class="ticket-detail-panel__row">
          <span class="ticket-detail-panel__label">Status</span>
          <TicketStatusSelect
            :model-value="ticket.status"
            :can-close="canCloseTicket(authStore.user, ticket)"
            @update:model-value="onStatusChange"
          />
        </div>

        <div class="ticket-detail-panel__row">
          <span class="ticket-detail-panel__label">Assignee</span>
          <AssigneePicker :assignee="ticket.assignee" @assign="onAssign" />
        </div>

        <button
          v-if="canDeleteTicket(authStore.user, ticket)"
          type="button"
          class="ticket-detail-panel__delete"
          @click="onDelete"
        >
          <PhIcon name="Trash2" size="xs" /> Delete ticket
        </button>
      </div>

      <div class="ticket-detail-panel__comments">
        <h3 class="ticket-detail-panel__comments-title">Comments</h3>
        <TicketCommentList :ticket-id="ticketId" />
        <TicketCommentComposer :ticket-id="ticketId" />
      </div>
    </template>

    <p v-else-if="notFound" class="ticket-detail-panel__not-found">Ticket not found.</p>
  </div>
</template>

<style scoped>
.ticket-detail-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 400px;
  border-left: 1px solid var(--ph-color-border-subtle);
  background-color: var(--ph-color-surface-raised);
}

.ticket-detail-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: var(--ph-space-3) var(--ph-space-4);
  border-bottom: 1px solid var(--ph-color-border-subtle);
}

.ticket-detail-panel__title-heading {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-2);
  margin: 0;
  font-size: var(--ph-font-size-md);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.ticket-detail-panel__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-muted);
}

.ticket-detail-panel__close:hover {
  background-color: var(--ph-color-surface-hover);
  color: var(--ph-color-text-default);
}

.ticket-detail-panel__loading {
  margin: var(--ph-space-6) auto;
}

.ticket-detail-panel__body {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-3);
  flex-shrink: 0;
  padding: var(--ph-space-4);
  border-bottom: 1px solid var(--ph-color-border-subtle);
}

.ticket-detail-panel__title {
  margin: 0;
  font-size: var(--ph-font-size-lg);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
  overflow-wrap: break-word;
}

.ticket-detail-panel__meta {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}

.ticket-detail-panel__description {
  margin: 0;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.ticket-detail-panel__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ph-space-3);
}

.ticket-detail-panel__label {
  font-size: var(--ph-font-size-xs);
  font-weight: var(--ph-font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ph-color-text-muted);
}

.ticket-detail-panel__delete {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-2);
  align-self: flex-start;
  padding: var(--ph-space-1) var(--ph-space-2);
  border-radius: var(--ph-radius-md);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-danger);
}

.ticket-detail-panel__delete:hover {
  background-color: var(--ph-color-danger-subtle);
}

.ticket-detail-panel__comments {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.ticket-detail-panel__comments-title {
  margin: 0;
  padding: var(--ph-space-3) var(--ph-space-4) 0;
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.ticket-detail-panel__not-found {
  padding: var(--ph-space-6);
  text-align: center;
  color: var(--ph-color-text-subtle);
}
</style>
