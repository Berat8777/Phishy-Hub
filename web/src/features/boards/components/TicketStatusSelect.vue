<script setup lang="ts">
import { computed } from 'vue';
import { PhSelect } from '@phishyhub/design-system';
import type { SelectOption } from '@phishyhub/design-system';
import { TICKET_STATUS_META, TICKET_STATUS_ORDER } from './BoardColumnHeader.vue';
import type { TicketStatus } from '../../../api/types';

/** `canClose` gates only the `closed` option (assignee/admin only, `assertCanCloseTicket` — permissions.ts's `canCloseTicket`); every other transition is unrestricted server-side (CONTRACT.md §3.9). */
const props = defineProps<{ modelValue: TicketStatus; disabled?: boolean; canClose?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: TicketStatus] }>();

const options = computed<SelectOption[]>(() =>
  TICKET_STATUS_ORDER.map((status) => ({
    label: TICKET_STATUS_META[status].label,
    value: status,
    disabled: status === 'closed' && props.canClose === false,
  })),
);

function onChange(value: string): void {
  emit('update:modelValue', value as TicketStatus);
}
</script>

<template>
  <PhSelect :model-value="modelValue" :options="options" :disabled="disabled" @update:model-value="onChange" />
</template>
