<script setup lang="ts">
/**
 * Visualizes `pending -> manager_approved -> approved` (CONTRACT.md §3.8).
 *
 * KNOWN LIMITATION (verified against the actual backend, not assumed): no
 * REST endpoint currently exposes the `leave_request_reviews` audit trail
 * that would let this render a full "who/when" per stage. The
 * `LeaveRequest` model DOES have a `reviews` association
 * (`hasMany(LeaveRequestReview, {as:'reviews'})`,
 * `api/src/models/index.ts`) and the table is populated
 * (`leaveRequest.service.ts::reviewLeaveRequest` writes a row per
 * decision), but `getLeaveRequestById`'s `REQUESTER_INCLUDE` never eager-
 * loads it, and there is no `/leave-requests/:id/reviews` route. The DTO's
 * `reviewedById`/`reviewedAt`/`reviewNote` fields are themselves only a
 * denormalized pointer to the LAST decision (documented as such in
 * CONTRACT.md §3.8), so for a fully `approved` request the stage-1
 * (manager) reviewer's specific identity/timestamp is not recoverable
 * client-side at all — only the final (hr) decision is. This component
 * renders what's actually available: stage completion inferred from
 * `status`, with reviewer detail attached only to the step the
 * denormalized fields actually describe. See this pass's HANDOFF for the
 * recommended backend follow-up (expose the audit trail, or at minimum a
 * `stage` field alongside `reviewedById`).
 */
import { computed } from 'vue';
import { PhIcon } from '@phishyhub/design-system';
import { formatDateOnly } from '../../../lib/date';
import type { LeaveRequestDTO } from '../../../api/types';

const props = defineProps<{ request: LeaveRequestDTO }>();

type StepState = 'done' | 'current' | 'upcoming' | 'skipped';

interface Step {
  key: string;
  label: string;
  state: StepState;
  detail?: string;
}

const reviewerName = computed(() => {
  const reviewer = props.request.reviewer;
  return reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : null;
});

const steps = computed<Step[]>(() => {
  const { status } = props.request;
  const submitted: Step = { key: 'submitted', label: 'Submitted', state: 'done', detail: formatDateOnly(props.request.createdAt.slice(0, 10)) };

  if (status === 'rejected' || status === 'cancelled') {
    // Ambiguous which stage terminated it (see doc comment) — render as a single terminal step
    // carrying whatever reviewer detail is actually available, rather than guessing a stage.
    const label = status === 'rejected' ? 'Rejected' : 'Cancelled';
    const detail =
      status === 'rejected' && reviewerName.value && props.request.reviewedAt
        ? `by ${reviewerName.value} · ${formatDateOnly(props.request.reviewedAt.slice(0, 10))}`
        : undefined;
    return [submitted, { key: 'terminal', label, state: 'done', detail }];
  }

  const managerStep: Step = { key: 'manager', label: 'Manager review', state: 'upcoming' };
  if (status === 'manager_approved' || status === 'approved') {
    managerStep.state = 'done';
    if (status === 'manager_approved' && reviewerName.value && props.request.reviewedAt) {
      managerStep.detail = `by ${reviewerName.value} · ${formatDateOnly(props.request.reviewedAt.slice(0, 10))}`;
    }
  } else {
    managerStep.state = 'current';
  }

  const hrStep: Step = { key: 'hr', label: 'HR final approval', state: 'upcoming' };
  if (status === 'approved') {
    hrStep.state = 'done';
    if (reviewerName.value && props.request.reviewedAt) {
      hrStep.detail = `by ${reviewerName.value} · ${formatDateOnly(props.request.reviewedAt.slice(0, 10))}`;
    }
  } else if (status === 'manager_approved') {
    hrStep.state = 'current';
  }

  return [submitted, managerStep, hrStep];
});
</script>

<template>
  <ol class="approval-chain-stepper">
    <li v-for="step in steps" :key="step.key" class="approval-chain-stepper__step" :class="`approval-chain-stepper__step--${step.state}`">
      <span class="approval-chain-stepper__icon">
        <PhIcon v-if="step.state === 'done'" name="Check" size="xs" />
        <PhIcon v-else-if="step.label === 'Rejected'" name="X" size="xs" />
        <span v-else class="approval-chain-stepper__dot" />
      </span>
      <span class="approval-chain-stepper__label">{{ step.label }}</span>
      <span v-if="step.detail" class="approval-chain-stepper__detail">{{ step.detail }}</span>
    </li>
  </ol>
</template>

<style scoped>
.approval-chain-stepper {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ph-space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}

.approval-chain-stepper__step {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-1);
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
}

.approval-chain-stepper__step:not(:last-child)::after {
  content: '';
  display: inline-block;
  width: 16px;
  height: 1px;
  margin-left: var(--ph-space-2);
  background-color: var(--ph-color-border-subtle);
}

.approval-chain-stepper__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: var(--ph-radius-full);
  background-color: var(--ph-color-surface-sunken);
  color: var(--ph-color-text-subtle);
}

.approval-chain-stepper__step--done .approval-chain-stepper__icon {
  background-color: var(--ph-color-success-subtle);
  color: var(--ph-color-success-subtle-text);
}

.approval-chain-stepper__step--current .approval-chain-stepper__icon {
  background-color: var(--ph-color-accent-subtle);
  color: var(--ph-color-accent-subtle-text);
}

.approval-chain-stepper__step--done .approval-chain-stepper__label {
  color: var(--ph-color-text-default);
}

.approval-chain-stepper__step--current .approval-chain-stepper__label {
  color: var(--ph-color-text-default);
  font-weight: var(--ph-font-weight-semibold);
}

.approval-chain-stepper__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--ph-radius-full);
  background-color: currentColor;
}

.approval-chain-stepper__detail {
  color: var(--ph-color-text-subtle);
}
</style>
