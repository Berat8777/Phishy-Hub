<script setup lang="ts">
import { computed, ref } from 'vue';
import { PhButton, PhIcon, PhTextarea, useToast } from '@phishyhub/design-system';
import UserAvatar from '../../../components/shared/UserAvatar.vue';
import { useTicketCommentsStore } from '../stores/ticketComments';
import { useAuthStore } from '../../../stores/auth';
import { canEditTicketComment } from '../../../lib/permissions';
import { formatRelative } from '../../../lib/date';
import { isApiError } from '../../../api/errors';
import type { TicketCommentDTO } from '../../../api/types';

const props = defineProps<{ ticketId: string }>();

const commentsStore = useTicketCommentsStore();
const authStore = useAuthStore();
const toast = useToast();

const comments = computed(() => commentsStore.getComments(props.ticketId));

const editingId = ref<string | null>(null);
const editBody = ref('');

function canEdit(comment: TicketCommentDTO): boolean {
  return canEditTicketComment(authStore.user, comment);
}

function startEdit(comment: TicketCommentDTO): void {
  editingId.value = comment.id;
  editBody.value = comment.body;
}

function cancelEdit(): void {
  editingId.value = null;
  editBody.value = '';
}

async function saveEdit(commentId: string): Promise<void> {
  const trimmed = editBody.value.trim();
  if (!trimmed) return;
  try {
    await commentsStore.editComment(props.ticketId, commentId, trimmed);
    editingId.value = null;
  } catch (err) {
    toast.push({
      title: 'Could not update comment',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  }
}

async function remove(commentId: string): Promise<void> {
  try {
    await commentsStore.removeComment(props.ticketId, commentId);
  } catch (err) {
    toast.push({
      title: 'Could not delete comment',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  }
}
</script>

<template>
  <ul class="ticket-comment-list">
    <li v-for="comment in comments" :key="comment.id" class="ticket-comment-list__item">
      <UserAvatar v-if="comment.author" :user-id="comment.author.id" size="sm" />
      <div class="ticket-comment-list__body">
        <div class="ticket-comment-list__header">
          <span class="ticket-comment-list__author">
            {{ comment.author ? `${comment.author.firstName} ${comment.author.lastName}` : 'Unknown user' }}
          </span>
          <span class="ticket-comment-list__time">{{ formatRelative(comment.createdAt) }}</span>
        </div>

        <template v-if="editingId === comment.id">
          <PhTextarea v-model="editBody" :rows="2" auto-grow />
          <div class="ticket-comment-list__edit-actions">
            <PhButton size="sm" variant="ghost" @click="cancelEdit">Cancel</PhButton>
            <PhButton size="sm" :disabled="!editBody.trim()" @click="saveEdit(comment.id)">Save</PhButton>
          </div>
        </template>
        <p v-else class="ticket-comment-list__text">{{ comment.body }}</p>
      </div>

      <div v-if="canEdit(comment) && editingId !== comment.id" class="ticket-comment-list__actions">
        <button type="button" class="ticket-comment-list__action" aria-label="Edit comment" @click="startEdit(comment)">
          <PhIcon name="Pencil" size="xs" />
        </button>
        <button type="button" class="ticket-comment-list__action" aria-label="Delete comment" @click="remove(comment.id)">
          <PhIcon name="Trash2" size="xs" />
        </button>
      </div>
    </li>
    <li v-if="comments.length === 0" class="ticket-comment-list__empty">No comments yet.</li>
  </ul>
</template>

<style scoped>
.ticket-comment-list {
  list-style: none;
  margin: 0;
  padding: var(--ph-space-3);
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-3);
  overflow-y: auto;
}

.ticket-comment-list__item {
  display: flex;
  align-items: flex-start;
  gap: var(--ph-space-2);
}

.ticket-comment-list__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
}

.ticket-comment-list__header {
  display: flex;
  align-items: baseline;
  gap: var(--ph-space-2);
}

.ticket-comment-list__author {
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.ticket-comment-list__time {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
}

.ticket-comment-list__text {
  margin: 0;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.ticket-comment-list__edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ph-space-2);
}

.ticket-comment-list__actions {
  display: flex;
  gap: var(--ph-space-1);
  flex-shrink: 0;
}

.ticket-comment-list__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--ph-radius-sm);
  color: var(--ph-color-text-subtle);
}

.ticket-comment-list__action:hover {
  background-color: var(--ph-color-surface-hover);
  color: var(--ph-color-text-default);
}

.ticket-comment-list__empty {
  padding: var(--ph-space-4);
  text-align: center;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-subtle);
}
</style>
