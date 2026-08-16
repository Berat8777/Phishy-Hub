<script setup lang="ts">
import { computed } from 'vue';
import UserAvatar from '../../../components/shared/UserAvatar.vue';
import LeaveStatusBadge from './LeaveStatusBadge.vue';
import { LEAVE_TYPE_META } from '../lib/leaveMeta';
import { formatDateOnly } from '../../../lib/date';
import { useUsersStore } from '../../../stores/users';
import type { LeaveRequestDTO } from '../../../api/types';

/** `showRequester` is on for approval-queue/team views; off for "my requests" (redundant there — it's always the viewer). */
const props = withDefaults(defineProps<{ request: LeaveRequestDTO; showRequester?: boolean }>(), {
  showRequester: false,
});

const usersStore = useUsersStore();

const typeLabel = computed(() => LEAVE_TYPE_META[props.request.type].label);

const requesterName = computed(() => {
  if (props.request.requester) return `${props.request.requester.firstName} ${props.request.requester.lastName}`;
  const cached = usersStore.getUser(props.request.userId);
  return cached ? `${cached.firstName} ${cached.lastName}` : '…';
});
</script>

<template>
  <div class="leave-request-row">
    <div v-if="showRequester" class="leave-request-row__person">
      <UserAvatar :user-id="request.userId" size="sm" />
      <span>{{ requesterName }}</span>
    </div>

    <div class="leave-request-row__main">
      <span class="leave-request-row__type">{{ typeLabel }}</span>
      <span class="leave-request-row__dates">
        {{ formatDateOnly(request.startDate) }} – {{ formatDateOnly(request.endDate) }}
      </span>
      <p v-if="request.reason" class="leave-request-row__reason">{{ request.reason }}</p>
    </div>

    <LeaveStatusBadge :status="request.status" />

    <div v-if="$slots.actions" class="leave-request-row__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.leave-request-row {
  display: flex;
  align-items: center;
  gap: var(--ph-space-4);
  padding: var(--ph-space-3);
  border-bottom: 1px solid var(--ph-color-border-subtle);
}

.leave-request-row:last-child {
  border-bottom: none;
}

.leave-request-row__person {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  flex: 0 0 160px;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
}

.leave-request-row__main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
}

.leave-request-row__type {
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.leave-request-row__dates {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-muted);
}

.leave-request-row__reason {
  margin: 0;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leave-request-row__actions {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  flex: 0 0 auto;
}
</style>
