<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { PhIcon, PhInput, PhSelect } from '@phishyhub/design-system';
import type { SelectOption } from '@phishyhub/design-system';
import * as departmentsApi from '../../../api/endpoints/departments';
import * as usersApi from '../../../api/endpoints/users';
import { useTicketsStore } from '../stores/tickets';
import { TICKET_PRIORITY_META, TICKET_PRIORITY_OPTIONS } from './PriorityBadge.vue';
import UserAvatar from '../../../components/shared/UserAvatar.vue';
import type { DepartmentDTO, TicketPriority, UserDTO } from '../../../api/types';

const ticketsStore = useTicketsStore();

const priority = ref<TicketPriority | ''>('');
const departmentId = ref('');
const departments = ref<DepartmentDTO[]>([]);

const assigneeQuery = ref('');
const assigneeResults = ref<UserDTO[]>([]);
const assigneeOpen = ref(false);
/** `'none'` mirrors CONTRACT.md §3.9's `assignedToId=none` special case (unassigned). */
const assigneeFilter = ref<{ id: string; label: string } | null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(async () => {
  try {
    const { items } = await departmentsApi.listDepartments({ pageSize: 100 });
    departments.value = items;
  } catch {
    departments.value = [];
  }
});

const priorityOptions = computed<SelectOption[]>(() => [
  { label: 'All priorities', value: '' },
  ...TICKET_PRIORITY_OPTIONS.map((p) => ({ label: TICKET_PRIORITY_META[p].label, value: p })),
]);

const departmentOptions = computed<SelectOption[]>(() => [
  { label: 'All departments', value: '' },
  ...departments.value.map((d) => ({ label: d.name, value: d.id })),
]);

function onPriorityChange(value: string): void {
  priority.value = value as TicketPriority | '';
}

function onDepartmentChange(value: string): void {
  departmentId.value = value;
}

async function searchAssignees(q: string): Promise<void> {
  try {
    const { items } = await usersApi.listUsers({ q, pageSize: 8 });
    assigneeResults.value = items;
  } catch {
    assigneeResults.value = [];
  }
}

watch(assigneeQuery, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void searchAssignees(q), 150);
});

function openAssigneeSearch(): void {
  assigneeOpen.value = true;
  if (assigneeResults.value.length === 0) void searchAssignees('');
}

function pickAssignee(user: UserDTO): void {
  assigneeFilter.value = { id: user.id, label: `${user.firstName} ${user.lastName}` };
  assigneeOpen.value = false;
  assigneeQuery.value = '';
}

function pickUnassigned(): void {
  assigneeFilter.value = { id: 'none', label: 'Unassigned' };
  assigneeOpen.value = false;
  assigneeQuery.value = '';
}

function clearAssignee(): void {
  assigneeFilter.value = null;
  assigneeOpen.value = false;
}

function applyFilters(): void {
  ticketsStore.setFilters({
    priority: priority.value || undefined,
    departmentId: departmentId.value || undefined,
    assignedToId: assigneeFilter.value?.id,
  });
  void ticketsStore.fetchAllColumns();
}

watch([priority, departmentId, assigneeFilter], applyFilters, { deep: true });
</script>

<template>
  <div class="board-filter-bar">
    <label class="board-filter-bar__field">
      <span>Priority</span>
      <PhSelect :model-value="priority" :options="priorityOptions" @update:model-value="onPriorityChange" />
    </label>

    <label class="board-filter-bar__field">
      <span>Department</span>
      <PhSelect :model-value="departmentId" :options="departmentOptions" @update:model-value="onDepartmentChange" />
    </label>

    <div class="board-filter-bar__field">
      <span>Assignee</span>
      <div class="board-filter-bar__assignee">
        <button type="button" class="board-filter-bar__assignee-trigger" @click="openAssigneeSearch">
          <PhIcon name="Search" size="xs" />
          <span>{{ assigneeFilter?.label ?? 'Anyone' }}</span>
        </button>
        <button
          v-if="assigneeFilter"
          type="button"
          class="board-filter-bar__assignee-clear"
          aria-label="Clear assignee filter"
          @click="clearAssignee"
        >
          <PhIcon name="X" size="xs" />
        </button>
      </div>

      <div v-if="assigneeOpen" class="board-filter-bar__assignee-panel">
        <PhInput v-model="assigneeQuery" placeholder="Search people…" />
        <ul class="board-filter-bar__assignee-list" role="listbox">
          <li>
            <button type="button" class="board-filter-bar__assignee-item" @click="pickUnassigned">Unassigned</button>
          </li>
          <li v-for="user in assigneeResults" :key="user.id">
            <button type="button" class="board-filter-bar__assignee-item" @click="pickAssignee(user)">
              <UserAvatar :user-id="user.id" size="xs" />
              <span>{{ user.firstName }} {{ user.lastName }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board-filter-bar {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-3);
  padding: var(--ph-space-3);
}

.board-filter-bar__field {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  font-size: var(--ph-font-size-xs);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.board-filter-bar__assignee {
  display: flex;
  align-items: center;
  gap: var(--ph-space-1);
}

.board-filter-bar__assignee-trigger {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  flex: 1;
  height: 40px;
  padding: 0 var(--ph-space-3);
  background-color: var(--ph-color-surface-raised);
  border: 1px solid var(--ph-color-border-strong);
  border-radius: var(--ph-radius-md);
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-normal);
  text-transform: none;
  letter-spacing: normal;
  color: var(--ph-color-text-default);
}

.board-filter-bar__assignee-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-muted);
}

.board-filter-bar__assignee-clear:hover {
  background-color: var(--ph-color-surface-hover);
}

.board-filter-bar__assignee-panel {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-2);
  margin-top: var(--ph-space-1);
  padding: var(--ph-space-2);
  background-color: var(--ph-color-surface-overlay);
  border: 1px solid var(--ph-color-border-subtle);
  border-radius: var(--ph-radius-md);
  box-shadow: var(--ph-shadow-md);
}

.board-filter-bar__assignee-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
}

.board-filter-bar__assignee-item {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  width: 100%;
  padding: var(--ph-space-2);
  border-radius: var(--ph-radius-sm);
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-normal);
  text-transform: none;
  letter-spacing: normal;
  color: var(--ph-color-text-default);
  text-align: left;
}

.board-filter-bar__assignee-item:hover {
  background-color: var(--ph-color-surface-hover);
}
</style>
