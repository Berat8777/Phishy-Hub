<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { PhButton, PhEmptyState, PhIcon, useToast } from '@phishyhub/design-system';
import { useLeaveStore } from '../stores/leave';
import LeaveRequestRow from '../components/LeaveRequestRow.vue';
import LeaveRequestForm from '../components/LeaveRequestForm.vue';
import LeaveBalanceCard from '../components/LeaveBalanceCard.vue';
import { isApiError } from '../../../api/errors';
import type { LeaveRequestStatus } from '../../../api/types';

const leaveStore = useLeaveStore();
const toast = useToast();

const createOpen = ref(false);
const cancellingId = ref<string | null>(null);

const CANCELLABLE: LeaveRequestStatus[] = ['pending', 'manager_approved', 'approved'];

const sortedRequests = computed(() =>
  [...leaveStore.myRequests].sort((a, b) => b.startDate.localeCompare(a.startDate)),
);

onMounted(async () => {
  await Promise.all([leaveStore.fetchMyRequests(), leaveStore.fetchBalance()]);
});

async function onCancel(id: string): Promise<void> {
  cancellingId.value = id;
  try {
    await leaveStore.cancelRequest(id);
    toast.push({ title: 'Request cancelled', variant: 'success' });
  } catch (err) {
    toast.push({
      title: 'Could not cancel request',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    cancellingId.value = null;
  }
}
</script>

<template>
  <div class="leave-requests-view">
    <header class="leave-requests-view__header">
      <h1 class="leave-requests-view__title">My leave requests</h1>
      <PhButton size="sm" @click="createOpen = true">
        <PhIcon name="Plus" size="sm" /> Request leave
      </PhButton>
    </header>

    <LeaveBalanceCard :balance="leaveStore.balance" :year="leaveStore.balanceYear" />

    <div class="leave-requests-view__list">
      <PhEmptyState
        v-if="!leaveStore.myRequestsLoading && sortedRequests.length === 0"
        title="No leave requests yet"
        description="Submit your first request with the button above."
      />
      <LeaveRequestRow v-for="request in sortedRequests" :key="request.id" :request="request">
        <template v-if="CANCELLABLE.includes(request.status)" #actions>
          <PhButton
            variant="ghost"
            size="sm"
            :loading="cancellingId === request.id"
            @click="onCancel(request.id)"
          >
            Cancel
          </PhButton>
        </template>
      </LeaveRequestRow>
    </div>

    <LeaveRequestForm v-model="createOpen" />
  </div>
</template>

<style scoped>
.leave-requests-view {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-5);
  max-width: 720px;
  padding: var(--ph-space-5);
  overflow-y: auto;
}

.leave-requests-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ph-space-3);
}

.leave-requests-view__title {
  margin: 0;
  font-size: var(--ph-font-size-lg);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.leave-requests-view__list {
  background-color: var(--ph-color-surface-raised);
  border: 1px solid var(--ph-color-border-subtle);
  border-radius: var(--ph-radius-lg);
}
</style>
