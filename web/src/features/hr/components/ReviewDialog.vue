<script setup lang="ts">
import { ref, watch } from 'vue';
import { PhButton, PhModal, PhTextarea, useToast } from '@phishyhub/design-system';
import { useLeaveStore } from '../stores/leave';
import { isApiError } from '../../../api/errors';
import type { LeaveRequestDTO, LeaveRequestReviewDecision } from '../../../api/types';

const props = defineProps<{ modelValue: boolean; request: LeaveRequestDTO | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; reviewed: [] }>();

const leaveStore = useLeaveStore();
const toast = useToast();

const decision = ref<LeaveRequestReviewDecision>('approve');
const reviewNote = ref('');
const submitting = ref(false);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      decision.value = 'approve';
      reviewNote.value = '';
    }
  },
);

function close(): void {
  emit('update:modelValue', false);
}

async function submit(): Promise<void> {
  if (!props.request) return;
  submitting.value = true;
  try {
    await leaveStore.reviewRequest(props.request.id, decision.value, reviewNote.value.trim() || undefined);
    toast.push({ title: decision.value === 'approve' ? 'Request approved' : 'Request rejected', variant: 'success' });
    emit('reviewed');
    close();
  } catch (err) {
    toast.push({
      title: 'Could not submit review',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <PhModal :model-value="modelValue" title="Review leave request" size="sm" @update:model-value="emit('update:modelValue', $event)">
    <div v-if="request" class="review-dialog">
      <div class="review-dialog__choices">
        <button
          type="button"
          class="review-dialog__choice"
          :class="{ 'review-dialog__choice--active': decision === 'approve' }"
          @click="decision = 'approve'"
        >
          Approve
        </button>
        <button
          type="button"
          class="review-dialog__choice review-dialog__choice--danger"
          :class="{ 'review-dialog__choice--active': decision === 'reject' }"
          @click="decision = 'reject'"
        >
          Reject
        </button>
      </div>

      <label class="review-dialog__field">
        <span>Note (optional)</span>
        <PhTextarea v-model="reviewNote" placeholder="Visible to the requester…" :rows="3" auto-grow />
      </label>
    </div>

    <template #footer>
      <PhButton variant="ghost" @click="close">Cancel</PhButton>
      <PhButton :variant="decision === 'reject' ? 'danger' : 'primary'" :loading="submitting" @click="submit">
        {{ decision === 'approve' ? 'Approve' : 'Reject' }}
      </PhButton>
    </template>
  </PhModal>
</template>

<style scoped>
.review-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
}

.review-dialog__choices {
  display: flex;
  gap: var(--ph-space-2);
}

.review-dialog__choice {
  flex: 1;
  height: 40px;
  border: 1px solid var(--ph-color-border-strong);
  border-radius: var(--ph-radius-md);
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-medium);
  color: var(--ph-color-text-default);
  background-color: var(--ph-color-surface-raised);
}

.review-dialog__choice:hover {
  background-color: var(--ph-color-surface-hover);
}

.review-dialog__choice--active {
  border-color: var(--ph-color-accent);
  background-color: var(--ph-color-accent-subtle);
  color: var(--ph-color-accent-subtle-text);
}

.review-dialog__choice--danger.review-dialog__choice--active {
  border-color: var(--ph-color-danger);
  background-color: var(--ph-color-danger-subtle);
  color: var(--ph-color-danger-subtle-text);
}

.review-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}
</style>
