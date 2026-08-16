<script setup lang="ts">
import { computed } from 'vue';

export type ProgressBarVariant = 'default' | 'success' | 'warning' | 'danger';

const props = withDefaults(
  defineProps<{
    value: number;
    max?: number;
    label?: string;
    variant?: ProgressBarVariant;
  }>(),
  {
    max: 100,
    label: undefined,
    variant: 'default',
  },
);

const clampedValue = computed(() => Math.min(Math.max(props.value, 0), props.max));
const percentage = computed(() => (props.max <= 0 ? 0 : (clampedValue.value / props.max) * 100));
</script>

<template>
  <div class="ph-progress-bar">
    <div v-if="label" class="ph-progress-bar__label">{{ label }}</div>
    <div
      class="ph-progress-bar__track"
      role="progressbar"
      :aria-valuenow="clampedValue"
      :aria-valuemin="0"
      :aria-valuemax="max"
      :aria-label="label || undefined"
    >
      <div
        class="ph-progress-bar__fill"
        :class="`ph-progress-bar__fill--${variant}`"
        :style="{ width: `${percentage}%` }"
      />
    </div>
  </div>
</template>

<style scoped>
.ph-progress-bar {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  width: 100%;
}

.ph-progress-bar__label {
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}

.ph-progress-bar__track {
  width: 100%;
  height: 8px;
  background-color: var(--ph-color-surface-sunken);
  border-radius: var(--ph-radius-full);
  overflow: hidden;
}

.ph-progress-bar__fill {
  height: 100%;
  border-radius: var(--ph-radius-full);
  transition: width var(--ph-duration-base) var(--ph-easing-standard);
}

.ph-progress-bar__fill--default {
  background-color: var(--ph-color-accent);
}

.ph-progress-bar__fill--success {
  background-color: var(--ph-color-success);
}

.ph-progress-bar__fill--warning {
  background-color: var(--ph-color-warning);
}

.ph-progress-bar__fill--danger {
  background-color: var(--ph-color-danger);
}
</style>
