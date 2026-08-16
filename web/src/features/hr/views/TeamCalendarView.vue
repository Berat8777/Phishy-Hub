<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { PhCalendarMonth, PhSelect } from '@phishyhub/design-system';
import type { SelectOption } from '@phishyhub/design-system';
import * as departmentsApi from '../../../api/endpoints/departments';
import { useAuthStore } from '../../../stores/auth';
import { useLeaveStore } from '../stores/leave';
import CalendarLeavePill from '../components/CalendarLeavePill.vue';
import type { DepartmentDTO } from '../../../api/types';

const authStore = useAuthStore();
const leaveStore = useLeaveStore();

const isPrivileged = computed(() => authStore.user?.role === 'hr' || authStore.user?.role === 'admin');

const now = new Date();
const year = ref(now.getUTCFullYear());
const month = ref(now.getUTCMonth() + 1);

const departments = ref<DepartmentDTO[]>([]);
/** hr/admin can view any department; everyone else is locked to their own (CONTRACT.md §3.8's `getLeaveCalendar`). */
const departmentId = ref<string>(authStore.user?.departmentId ?? '');

const departmentOptions = computed<SelectOption[]>(() => departments.value.map((d) => ({ label: d.name, value: d.id })));

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function monthRange(y: number, m: number): { from: string; to: string } {
  const from = `${y}-${pad2(m)}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${y}-${pad2(m)}-${pad2(lastDay)}`;
  return { from, to };
}

async function refetch(): Promise<void> {
  if (!departmentId.value) return;
  const { from, to } = monthRange(year.value, month.value);
  await leaveStore.fetchCalendar(from, to, departmentId.value);
}

function onNavigate(payload: { year: number; month: number }): void {
  year.value = payload.year;
  month.value = payload.month;
}

function onDepartmentChange(value: string): void {
  departmentId.value = value;
}

const entriesByDate = computed(() => {
  const map = new Map<string, typeof leaveStore.calendarEntries>();
  for (const entry of leaveStore.calendarEntries) {
    let cursor = entry.startDate;
    while (cursor <= entry.endDate) {
      const list = map.get(cursor) ?? [];
      list.push(entry);
      map.set(cursor, list);
      // Plain string increment via Date.UTC round-trip (date-only strings sort/compare lexicographically, but arithmetic still needs a real Date).
      const [y, m, d] = cursor.split('-').map(Number);
      const next = new Date(Date.UTC(y, m - 1, d + 1));
      cursor = `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
    }
  }
  return map;
});

onMounted(async () => {
  try {
    const { items } = await departmentsApi.listDepartments({ pageSize: 100 });
    departments.value = items;
  } catch {
    departments.value = [];
  }
  await refetch();
});

watch([year, month, departmentId], refetch);
</script>

<template>
  <div class="team-calendar-view">
    <header class="team-calendar-view__header">
      <h1 class="team-calendar-view__title">Team calendar</h1>
      <label v-if="isPrivileged" class="team-calendar-view__department">
        <span>Department</span>
        <PhSelect :model-value="departmentId" :options="departmentOptions" @update:model-value="onDepartmentChange" />
      </label>
    </header>

    <PhCalendarMonth :year="year" :month="month" @navigate="onNavigate">
      <template #default="{ date, isCurrentMonth }">
        <div class="team-calendar-view__cell" :class="{ 'team-calendar-view__cell--outside': !isCurrentMonth }">
          <span class="team-calendar-view__day-number">{{ Number(date.slice(-2)) }}</span>
          <div class="team-calendar-view__pills">
            <CalendarLeavePill v-for="entry in entriesByDate.get(date) ?? []" :key="entry.id" :entry="entry" />
          </div>
        </div>
      </template>
    </PhCalendarMonth>
  </div>
</template>

<style scoped>
.team-calendar-view {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
  padding: var(--ph-space-5);
  overflow-y: auto;
}

.team-calendar-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ph-space-3);
}

.team-calendar-view__title {
  margin: 0;
  font-size: var(--ph-font-size-lg);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.team-calendar-view__department {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
  width: 220px;
}

.team-calendar-view__cell {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  height: 100%;
}

.team-calendar-view__cell--outside {
  opacity: 0.6;
}

.team-calendar-view__day-number {
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-medium);
  color: var(--ph-color-text-default);
}

.team-calendar-view__pills {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}
</style>
