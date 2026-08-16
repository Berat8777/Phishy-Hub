<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { PhButton, PhEmptyState } from '@phishyhub/design-system';
import { useAuthStore } from '../../../stores/auth';
import { useLeaveStore } from '../stores/leave';
import { canReviewLeave } from '../../../lib/permissions';
import LeaveRequestRow from '../components/LeaveRequestRow.vue';
import ApprovalChainStepper from '../components/ApprovalChainStepper.vue';
import ReviewDialog from '../components/ReviewDialog.vue';
import type { LeaveRequestDTO } from '../../../api/types';

/**
 * "Requires canReviewLeave-worthy role OR being a manager" is not a pure
 * `meta.roles` check (a department manager isn't a role, CONTRACT.md §3.4),
 * so access is verified here rather than solely in `router/guards.ts`
 * (per the task brief) — redirect to `/hr` if the user is neither hr/admin
 * nor manages any department.
 */
const router = useRouter();
const authStore = useAuthStore();
const leaveStore = useLeaveStore();

const hasAccess = computed(() => {
  const user = authStore.user;
  if (!user) return false;
  if (user.role === 'hr' || user.role === 'admin') return true;
  return (user.managedDepartmentIds ?? []).length > 0;
});

const reviewTarget = ref<LeaveRequestDTO | null>(null);
const reviewOpen = ref(false);

function openReview(request: LeaveRequestDTO): void {
  reviewTarget.value = request;
  reviewOpen.value = true;
}

onMounted(async () => {
  if (!hasAccess.value) {
    await router.replace({ name: 'hr' });
    return;
  }
  await leaveStore.fetchApprovalsQueue();
});
</script>

<template>
  <div v-if="hasAccess" class="leave-approvals-view">
    <header class="leave-approvals-view__header">
      <h1 class="leave-approvals-view__title">Approvals</h1>
    </header>

    <PhEmptyState
      v-if="!leaveStore.approvalsLoading && leaveStore.approvalsQueue.length === 0"
      title="Nothing awaiting your review"
      description="Requests pending your approval will show up here."
    />

    <div v-for="request in leaveStore.approvalsQueue" :key="request.id" class="leave-approvals-view__item">
      <LeaveRequestRow :request="request" show-requester>
        <template v-if="canReviewLeave(authStore.user, request)" #actions>
          <PhButton size="sm" @click="openReview(request)">Review</PhButton>
        </template>
      </LeaveRequestRow>
      <div class="leave-approvals-view__stepper">
        <ApprovalChainStepper :request="request" />
      </div>
    </div>

    <ReviewDialog v-model="reviewOpen" :request="reviewTarget" />
  </div>
</template>

<style scoped>
.leave-approvals-view {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
  max-width: 840px;
  padding: var(--ph-space-5);
  overflow-y: auto;
}

.leave-approvals-view__title {
  margin: 0;
  font-size: var(--ph-font-size-lg);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.leave-approvals-view__item {
  background-color: var(--ph-color-surface-raised);
  border: 1px solid var(--ph-color-border-subtle);
  border-radius: var(--ph-radius-lg);
}

.leave-approvals-view__stepper {
  padding: 0 var(--ph-space-3) var(--ph-space-3);
}
</style>
