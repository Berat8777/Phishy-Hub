<script setup lang="ts">
/**
 * Month-grid calendar for showing per-day content — not a date picker (no
 * selection state, this only renders the grid). Owns the weekday headers,
 * day-of-week alignment, and dimmed leading/trailing days from adjacent
 * months; per-cell content is entirely up to the consumer via the scoped
 * `default` slot.
 *
 * All grid math is done with `Date.UTC` day-arithmetic (never local-time
 * `Date` parsing of a date string), so cell dates can't shift by a day near
 * a local-timezone midnight/DST boundary.
 */
import { computed } from 'vue';
import PhIcon from '../PhIcon/PhIcon.vue';

export interface PhCalendarDayCell {
  /** 'YYYY-MM-DD' */
  date: string;
  isToday: boolean;
  isCurrentMonth: boolean;
}

export interface PhCalendarNavigatePayload {
  year: number;
  month: number;
}

const props = defineProps<{
  year: number;
  /** 1-12 (January = 1). */
  month: number;
}>();

const emit = defineEmits<{
  navigate: [payload: PhCalendarNavigatePayload];
}>();

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

const monthLabel = computed(() =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(props.year, props.month - 1, 1)),
  ),
);

const todayString = computed(() => {
  // "Today" is a local-calendar concept, deliberately read via local
  // getters (not toISOString(), which converts to UTC and can shift the
  // date near midnight).
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
});

const cells = computed<PhCalendarDayCell[]>(() => {
  const zeroBasedMonth = props.month - 1;
  const firstWeekday = new Date(Date.UTC(props.year, zeroBasedMonth, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(props.year, zeroBasedMonth + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const dayOffset = index - firstWeekday + 1;
    const cellDate = new Date(Date.UTC(props.year, zeroBasedMonth, dayOffset));
    const date = `${cellDate.getUTCFullYear()}-${pad2(cellDate.getUTCMonth() + 1)}-${pad2(cellDate.getUTCDate())}`;
    return {
      date,
      isToday: date === todayString.value,
      isCurrentMonth: cellDate.getUTCMonth() === zeroBasedMonth && cellDate.getUTCFullYear() === props.year,
    };
  });
});

function goToPrevious(): void {
  const prevMonth = props.month - 1;
  emit('navigate', prevMonth < 1 ? { year: props.year - 1, month: 12 } : { year: props.year, month: prevMonth });
}

function goToNext(): void {
  const nextMonth = props.month + 1;
  emit('navigate', nextMonth > 12 ? { year: props.year + 1, month: 1 } : { year: props.year, month: nextMonth });
}
</script>

<template>
  <div class="ph-calendar-month">
    <header class="ph-calendar-month__header">
      <button type="button" class="ph-calendar-month__nav" aria-label="Previous month" @click="goToPrevious">
        <PhIcon name="ChevronLeft" size="sm" />
      </button>
      <p class="ph-calendar-month__title">{{ monthLabel }}</p>
      <button type="button" class="ph-calendar-month__nav" aria-label="Next month" @click="goToNext">
        <PhIcon name="ChevronRight" size="sm" />
      </button>
    </header>
    <div class="ph-calendar-month__weekdays" aria-hidden="true">
      <span v-for="label in WEEKDAY_LABELS" :key="label" class="ph-calendar-month__weekday">{{ label }}</span>
    </div>
    <div class="ph-calendar-month__grid">
      <div
        v-for="cell in cells"
        :key="cell.date"
        class="ph-calendar-month__cell"
        :class="{
          'ph-calendar-month__cell--outside': !cell.isCurrentMonth,
          'ph-calendar-month__cell--today': cell.isToday,
        }"
      >
        <slot :date="cell.date" :is-today="cell.isToday" :is-current-month="cell.isCurrentMonth">
          <span class="ph-calendar-month__day-number">{{ Number(cell.date.slice(-2)) }}</span>
        </slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ph-calendar-month {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-2);
}

.ph-calendar-month__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ph-space-3);
}

.ph-calendar-month__title {
  font-size: var(--ph-font-size-md);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.ph-calendar-month__nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-muted);
}

.ph-calendar-month__nav:hover {
  background-color: var(--ph-color-surface-hover);
}

.ph-calendar-month__nav:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
}

.ph-calendar-month__weekdays,
.ph-calendar-month__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.ph-calendar-month__weekday {
  padding: var(--ph-space-1) var(--ph-space-2);
  font-size: var(--ph-font-size-xs);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-subtle);
  text-align: center;
  text-transform: uppercase;
}

.ph-calendar-month__cell {
  min-height: 96px;
  padding: var(--ph-space-2);
  background-color: var(--ph-color-surface-raised);
  border: 1px solid var(--ph-color-border-subtle);
  color: var(--ph-color-text-default);
}

.ph-calendar-month__cell--outside {
  background-color: var(--ph-color-surface-sunken);
  color: var(--ph-color-text-subtle);
}

.ph-calendar-month__cell--today {
  border-color: var(--ph-color-accent);
  box-shadow: inset 0 0 0 1px var(--ph-color-accent);
}

.ph-calendar-month__day-number {
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-medium);
}
</style>
