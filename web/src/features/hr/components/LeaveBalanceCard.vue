<script setup lang="ts">
import { computed } from 'vue';
import { PhCard, PhProgressBar } from '@phishyhub/design-system';
import type { ProgressBarVariant } from '@phishyhub/design-system';
import { LEAVE_TYPE_META } from '../lib/leaveMeta';
import type { LeaveBalanceDTO } from '../../../api/types';

const props = defineProps<{ balance: LeaveBalanceDTO[]; year: number }>();

/**
 * Only `'annual'` deducts against entitlement (`remainingDays !== null`,
 * CONTRACT.md §3.8) — that's the one row worth a progress bar. The other
 * types (`sick`/`unpaid`/`other`) are tracked/shown as plain used/pending
 * counts underneath since they have no limit to visualize against.
 */
const annual = computed(() => props.balance.find((b) => b.type === 'annual'));
const otherTypes = computed(() => props.balance.filter((b) => b.type !== 'annual'));

const annualMax = computed(() => (annual.value ? annual.value.entitledDays + annual.value.carriedOverDays : 0));
const annualVariant = computed<ProgressBarVariant>(() => {
  const a = annual.value;
  if (!a || a.remainingDays === null) return 'default';
  if (a.remainingDays <= 0) return 'danger';
  if (a.remainingDays <= 3) return 'warning';
  return 'success';
});
</script>

<template>
  <PhCard class="leave-balance-card">
    <template #header>
      <h3 class="leave-balance-card__title">Leave balance — {{ year }}</h3>
    </template>

    <div v-if="annual" class="leave-balance-card__annual">
      <PhProgressBar
        :value="annual.usedDays + annual.pendingDays"
        :max="annualMax || 1"
        :variant="annualVariant"
        :label="`Annual — ${annual.remainingDays ?? 0} days remaining`"
      />
      <p class="leave-balance-card__breakdown">
        {{ annual.entitledDays }} entitled + {{ annual.carriedOverDays }} carried over · {{ annual.usedDays }} used ·
        {{ annual.pendingDays }} pending
      </p>
    </div>

    <ul v-if="otherTypes.length > 0" class="leave-balance-card__list">
      <li v-for="entry in otherTypes" :key="entry.type" class="leave-balance-card__list-item">
        <span>{{ LEAVE_TYPE_META[entry.type].label }}</span>
        <span class="leave-balance-card__list-detail">{{ entry.usedDays }} used · {{ entry.pendingDays }} pending</span>
      </li>
    </ul>
  </PhCard>
</template>

<style scoped>
.leave-balance-card__title {
  margin: 0;
  font-size: var(--ph-font-size-md);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.leave-balance-card__annual {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-2);
}

.leave-balance-card__breakdown {
  margin: 0;
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-muted);
}

.leave-balance-card__list {
  list-style: none;
  margin: var(--ph-space-4) 0 0;
  padding: var(--ph-space-3) 0 0;
  border-top: 1px solid var(--ph-color-border-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-2);
}

.leave-balance-card__list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
}

.leave-balance-card__list-detail {
  color: var(--ph-color-text-muted);
}
</style>
