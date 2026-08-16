<script setup lang="ts">
import { computed } from 'vue';
import { PhTooltip } from '@phishyhub/design-system';
import UserAvatar from '../../../components/shared/UserAvatar.vue';
import { LEAVE_STATUS_META } from './LeaveStatusBadge.vue';
import { LEAVE_TYPE_META } from '../lib/leaveMeta';
import { formatDateOnly } from '../../../lib/date';
import type { LeaveCalendarEntryDTO } from '../../../api/types';

const props = defineProps<{ entry: LeaveCalendarEntryDTO }>();

const statusMeta = computed(() => LEAVE_STATUS_META[props.entry.status]);
const typeMeta = computed(() => LEAVE_TYPE_META[props.entry.type]);
const name = computed(() => `${props.entry.user.firstName} ${props.entry.user.lastName}`);

/**
 * `getLeaveCalendar` only ever returns `pending`/`manager_approved`/`approved`
 * entries (`LEAVE_REQUEST_ACTIVE_STATUSES`, api/src/utils/constants.ts) — of
 * those, only `approved` is a done deal; the other two are still moving
 * through the review chain and could still be rejected. The pill renders
 * that distinction as solid/filled (confirmed) vs outlined/dashed
 * (tentative) rather than another color, so it reads as "how sure is this"
 * independent of the type color.
 */
const isConfirmed = computed(() => props.entry.status === 'approved');

const dateRangeLabel = computed(() =>
  props.entry.startDate === props.entry.endDate
    ? formatDateOnly(props.entry.startDate)
    : `${formatDateOnly(props.entry.startDate)} – ${formatDateOnly(props.entry.endDate)}`,
);

const tooltipText = computed(
  () => `${name.value} · ${typeMeta.value.label} leave · ${dateRangeLabel.value} · ${statusMeta.value.label}`,
);
</script>

<template>
  <PhTooltip :text="tooltipText" placement="top">
    <div
      class="calendar-leave-pill"
      :class="[
        `calendar-leave-pill--${typeMeta.variant}`,
        isConfirmed ? 'calendar-leave-pill--confirmed' : 'calendar-leave-pill--tentative',
      ]"
    >
      <UserAvatar :user-id="entry.userId" size="xs" />
      <span class="calendar-leave-pill__body">
        <span class="calendar-leave-pill__name">{{ name }}</span>
        <span class="calendar-leave-pill__type">{{ typeMeta.label }}<template v-if="!isConfirmed"> · {{ statusMeta.label }}</template></span>
      </span>
    </div>
  </PhTooltip>
</template>

<style scoped>
.calendar-leave-pill {
  display: flex;
  align-items: center;
  gap: var(--ph-space-1);
  width: 100%;
  padding: 2px var(--ph-space-1);
  border: 1px solid transparent;
  border-radius: var(--ph-radius-sm);
  font-size: var(--ph-font-size-xs);
  overflow: hidden;
  cursor: default;
}

.calendar-leave-pill__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.2;
}

.calendar-leave-pill__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: var(--ph-font-weight-medium);
  color: var(--ph-color-text-default);
}

.calendar-leave-pill__type {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

/* Type hue — a distinct axis from status, so the two never fight over the same color. */
.calendar-leave-pill--accent {
  --pill-color: var(--ph-color-accent);
  --pill-subtle-bg: var(--ph-color-accent-subtle);
  --pill-subtle-text: var(--ph-color-accent-subtle-text);
}

.calendar-leave-pill--danger {
  --pill-color: var(--ph-color-danger);
  --pill-subtle-bg: var(--ph-color-danger-subtle);
  --pill-subtle-text: var(--ph-color-danger-subtle-text);
}

.calendar-leave-pill--warning {
  --pill-color: var(--ph-color-warning);
  --pill-subtle-bg: var(--ph-color-warning-subtle);
  --pill-subtle-text: var(--ph-color-warning-subtle-text);
}

.calendar-leave-pill--default {
  --pill-color: var(--ph-color-text-subtle);
  --pill-subtle-bg: var(--ph-color-surface-sunken);
  --pill-subtle-text: var(--ph-color-text-muted);
}

/* Confirmed (approved) — solid fill in the type's color, so it reads as "locked in" at a glance. */
.calendar-leave-pill--confirmed {
  background-color: var(--pill-subtle-bg);
  border-color: var(--pill-color);
}

.calendar-leave-pill--confirmed .calendar-leave-pill__type {
  color: var(--pill-subtle-text);
  font-weight: var(--ph-font-weight-semibold);
}

/* Tentative (pending / manager_approved) — dashed outline on a plain surface, so it visibly reads as "not final yet". */
.calendar-leave-pill--tentative {
  background-color: var(--ph-color-surface-raised);
  border-style: dashed;
  border-color: var(--pill-color);
}

.calendar-leave-pill--tentative .calendar-leave-pill__type {
  color: var(--pill-color);
}
</style>
