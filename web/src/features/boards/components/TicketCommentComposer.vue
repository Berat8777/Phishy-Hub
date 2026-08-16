<script setup lang="ts">
import { ref } from 'vue';
import { PhButton, PhTextarea, useToast } from '@phishyhub/design-system';
import { useTicketCommentsStore } from '../stores/ticketComments';
import { isApiError } from '../../../api/errors';

const props = defineProps<{ ticketId: string }>();

const commentsStore = useTicketCommentsStore();
const toast = useToast();
const body = ref('');
const sending = ref(false);

async function onSend(): Promise<void> {
  const trimmed = body.value.trim();
  if (!trimmed) return;
  sending.value = true;
  try {
    await commentsStore.addComment(props.ticketId, trimmed);
    body.value = '';
  } catch (err) {
    toast.push({
      title: 'Could not post comment',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    sending.value = false;
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void onSend();
  }
}
</script>

<template>
  <div class="ticket-comment-composer">
    <PhTextarea v-model="body" placeholder="Write a comment…" :rows="2" auto-grow @keydown="onKeydown" />
    <PhButton size="sm" :loading="sending" :disabled="!body.trim()" @click="onSend">Send</PhButton>
  </div>
</template>

<style scoped>
.ticket-comment-composer {
  display: flex;
  align-items: flex-end;
  gap: var(--ph-space-2);
  padding: var(--ph-space-3);
  border-top: 1px solid var(--ph-color-border-subtle);
}

.ticket-comment-composer :deep(.ph-textarea) {
  flex: 1;
}
</style>
