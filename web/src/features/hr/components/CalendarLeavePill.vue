<script setup lang="ts">
import { computed } from 'vue';
import UserAvatar from '../../../components/shared/UserAvatar.vue';
import { LEAVE_STATUS_META } from './LeaveStatusBadge.vue';
import type { LeaveCalendarEntryDTO } from '../../../api/types';

const props = defineProps<{ entry: LeaveCalendarEntryDTO }>();

const meta = computed(() => LEAVE_STATUS_META[props.entry.status]);
const name = computed(() => `${props.entry.user.firstName} ${props.entry.user.lastName}`);
</script>

<template>
  <div class="calendar-leave-pill" :class="`calendar-leave-pill--${meta.variant}`" :title="`${name} · ${meta.label}`">
    <UserAvatar :user-id="entry.userId" size="xs" />
    <span class="calendar-leave-pill__name">{{ name }}</span>
  </div>
</template>

<style scoped>
.calendar-leave-pill {
  display: flex;
  align-items: center;
  gap: var(--ph-space-1);
  padding: 2px var(--ph-space-1);
  border-radius: var(--ph-radius-sm);
  font-size: var(--ph-font-size-xs);
  background-color: var(--ph-color-surface-sunken);
  color: var(--ph-color-text-muted);
  overflow: hidden;
}

.calendar-leave-pill__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calendar-leave-pill--accent {
  background-color: var(--ph-color-accent-subtle);
  color: var(--ph-color-accent-subtle-text);
}

.calendar-leave-pill--success {
  background-color: var(--ph-color-success-subtle);
  color: var(--ph-color-success-subtle-text);
}

.calendar-leave-pill--warning {
  background-color: var(--ph-color-warning-subtle);
  color: var(--ph-color-warning-subtle-text);
}

.calendar-leave-pill--danger {
  background-color: var(--ph-color-danger-subtle);
  color: var(--ph-color-danger-subtle-text);
}
</style>
