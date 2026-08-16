<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { PhButton, PhInput, PhModal, PhSelect, PhTextarea, useToast } from '@phishyhub/design-system';
import type { SelectOption } from '@phishyhub/design-system';
import * as departmentsApi from '../../../api/endpoints/departments';
import { useTicketsStore } from '../stores/tickets';
import { isApiError } from '../../../api/errors';
import { TICKET_PRIORITY_META, TICKET_PRIORITY_OPTIONS } from './PriorityBadge.vue';
import type { DepartmentDTO, TicketPriority } from '../../../api/types';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [ticketId: string] }>();

const ticketsStore = useTicketsStore();
const toast = useToast();

const title = ref('');
const description = ref('');
const priority = ref<TicketPriority>('medium');
const departmentId = ref('');
const departments = ref<DepartmentDTO[]>([]);
const creating = ref(false);

const priorityOptions: SelectOption[] = TICKET_PRIORITY_OPTIONS.map((p) => ({
  label: TICKET_PRIORITY_META[p].label,
  value: p,
}));

onMounted(async () => {
  try {
    const { items } = await departmentsApi.listDepartments({ pageSize: 100 });
    departments.value = items;
  } catch {
    departments.value = [];
  }
});

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      title.value = '';
      description.value = '';
      priority.value = 'medium';
      departmentId.value = '';
    }
  },
);

function onPriorityChange(value: string): void {
  priority.value = value as TicketPriority;
}

function onDepartmentChange(value: string): void {
  departmentId.value = value;
}

async function onCreate(): Promise<void> {
  const trimmed = title.value.trim();
  if (!trimmed) return;
  creating.value = true;
  try {
    const ticket = await ticketsStore.createTicket({
      title: trimmed,
      description: description.value.trim() || undefined,
      priority: priority.value,
      departmentId: departmentId.value || undefined,
    });
    emit('created', ticket.id);
    emit('update:modelValue', false);
    toast.push({ title: 'Ticket created', variant: 'success' });
  } catch (err) {
    toast.push({
      title: 'Could not create ticket',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <PhModal :model-value="modelValue" title="New ticket" size="md" @update:model-value="emit('update:modelValue', $event)">
    <div class="ticket-create-dialog">
      <label class="ticket-create-dialog__field">
        <span>Title</span>
        <PhInput v-model="title" placeholder="Short summary" />
      </label>

      <label class="ticket-create-dialog__field">
        <span>Description</span>
        <PhTextarea v-model="description" placeholder="Optional details…" :rows="4" auto-grow />
      </label>

      <div class="ticket-create-dialog__row">
        <label class="ticket-create-dialog__field">
          <span>Priority</span>
          <PhSelect :model-value="priority" :options="priorityOptions" @update:model-value="onPriorityChange" />
        </label>

        <label class="ticket-create-dialog__field">
          <span>Department</span>
          <PhSelect
            :model-value="departmentId"
            :options="[{ label: 'None', value: '' }, ...departments.map((d) => ({ label: d.name, value: d.id }))]"
            @update:model-value="onDepartmentChange"
          />
        </label>
      </div>
    </div>

    <template #footer>
      <PhButton variant="ghost" @click="emit('update:modelValue', false)">Cancel</PhButton>
      <PhButton :loading="creating" :disabled="!title.trim()" @click="onCreate">Create</PhButton>
    </template>
  </PhModal>
</template>

<style scoped>
.ticket-create-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
}

.ticket-create-dialog__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ph-space-3);
}

.ticket-create-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}
</style>
