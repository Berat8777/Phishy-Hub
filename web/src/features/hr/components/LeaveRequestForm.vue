<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { PhButton, PhDateInput, PhModal, PhSelect, PhTextarea, useToast } from '@phishyhub/design-system';
import type { SelectOption } from '@phishyhub/design-system';
import { useLeaveStore } from '../stores/leave';
import { LEAVE_TYPE_META, LEAVE_TYPE_OPTIONS } from '../lib/leaveMeta';
import { countBusinessDays } from '../../../lib/date';
import { isApiError } from '../../../api/errors';
import type { LeaveRequestType } from '../../../api/types';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [] }>();

const leaveStore = useLeaveStore();
const toast = useToast();

const type = ref<LeaveRequestType>('annual');
const startDate = ref('');
const endDate = ref('');
const reason = ref('');
const submitting = ref(false);

const typeOptions: SelectOption[] = LEAVE_TYPE_OPTIONS.map((t) => ({ label: LEAVE_TYPE_META[t].label, value: t }));

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      type.value = 'annual';
      startDate.value = '';
      endDate.value = '';
      reason.value = '';
    }
  },
);

function onTypeChange(value: string): void {
  type.value = value as LeaveRequestType;
}

const requestedDays = computed(() => {
  if (!startDate.value || !endDate.value) return 0;
  return countBusinessDays(startDate.value, endDate.value);
});

/**
 * Informational only, per the architect's call — never blocks submit.
 * `remainingDays` is `null` for non-annual types (they don't deduct against
 * entitlement, CONTRACT.md §3.8), so the warning only applies to `annual`.
 */
const balanceWarning = computed(() => {
  if (type.value !== 'annual' || requestedDays.value === 0) return null;
  const annual = leaveStore.balance.find((b) => b.type === 'annual');
  if (!annual || annual.remainingDays === null) return null;
  if (requestedDays.value > annual.remainingDays) {
    return `This request (${requestedDays.value} business day${requestedDays.value === 1 ? '' : 's'}) exceeds your remaining annual balance (${annual.remainingDays}).`;
  }
  return null;
});

const canSubmit = computed(() => Boolean(startDate.value && endDate.value && startDate.value <= endDate.value));

async function onSubmit(): Promise<void> {
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    await leaveStore.createRequest({
      type: type.value,
      startDate: startDate.value,
      endDate: endDate.value,
      reason: reason.value.trim() || undefined,
    });
    toast.push({ title: 'Leave request submitted', variant: 'success' });
    emit('created');
    emit('update:modelValue', false);
  } catch (err) {
    toast.push({
      title: 'Could not submit request',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <PhModal :model-value="modelValue" title="Request leave" size="md" @update:model-value="emit('update:modelValue', $event)">
    <div class="leave-request-form">
      <label class="leave-request-form__field">
        <span>Type</span>
        <PhSelect :model-value="type" :options="typeOptions" @update:model-value="onTypeChange" />
      </label>

      <div class="leave-request-form__row">
        <label class="leave-request-form__field">
          <span>Start date</span>
          <PhDateInput v-model="startDate" :max="endDate || undefined" />
        </label>
        <label class="leave-request-form__field">
          <span>End date</span>
          <PhDateInput v-model="endDate" :min="startDate || undefined" />
        </label>
      </div>

      <label class="leave-request-form__field">
        <span>Reason (optional)</span>
        <PhTextarea v-model="reason" placeholder="Optional details…" :rows="3" auto-grow />
      </label>

      <p v-if="requestedDays > 0" class="leave-request-form__days">
        {{ requestedDays }} business day{{ requestedDays === 1 ? '' : 's' }}
      </p>
      <p v-if="balanceWarning" class="leave-request-form__warning">{{ balanceWarning }}</p>
    </div>

    <template #footer>
      <PhButton variant="ghost" @click="emit('update:modelValue', false)">Cancel</PhButton>
      <PhButton :loading="submitting" :disabled="!canSubmit" @click="onSubmit">Submit</PhButton>
    </template>
  </PhModal>
</template>

<style scoped>
.leave-request-form {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
}

.leave-request-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ph-space-3);
}

.leave-request-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}

.leave-request-form__days {
  margin: 0;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}

.leave-request-form__warning {
  margin: 0;
  padding: var(--ph-space-2) var(--ph-space-3);
  background-color: var(--ph-color-warning-subtle);
  color: var(--ph-color-warning-subtle-text);
  border-radius: var(--ph-radius-md);
  font-size: var(--ph-font-size-sm);
}
</style>
