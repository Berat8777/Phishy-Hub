<script setup lang="ts">
import { computed } from 'vue';
import PhSpinner from '../PhSpinner/PhSpinner.vue';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    disabled: false,
    loading: false,
  },
);

const isDisabled = computed(() => props.disabled || props.loading);
</script>

<template>
  <button
    class="ph-button"
    :class="[`ph-button--${variant}`, `ph-button--${size}`, { 'ph-button--loading': loading }]"
    :type="type"
    :disabled="isDisabled"
    :aria-busy="loading || undefined"
  >
    <PhSpinner v-if="loading" class="ph-button__spinner" size="sm" />
    <span class="ph-button__content" :class="{ 'ph-button__content--hidden': loading }">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.ph-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ph-space-2);
  position: relative;
  font-family: var(--ph-font-family-base);
  font-weight: var(--ph-font-weight-medium);
  border-radius: var(--ph-radius-md);
  border: 1px solid transparent;
  transition:
    background-color var(--ph-duration-fast) var(--ph-easing-standard),
    border-color var(--ph-duration-fast) var(--ph-easing-standard),
    color var(--ph-duration-fast) var(--ph-easing-standard);
  white-space: nowrap;
}

.ph-button:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
}

.ph-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Sizes */
.ph-button--sm {
  height: 32px;
  padding: 0 var(--ph-space-3);
  font-size: var(--ph-font-size-sm);
}

.ph-button--md {
  height: 40px;
  padding: 0 var(--ph-space-4);
  font-size: var(--ph-font-size-md);
}

.ph-button--lg {
  height: 48px;
  padding: 0 var(--ph-space-5);
  font-size: var(--ph-font-size-lg);
}

/* Variants */
.ph-button--primary {
  background-color: var(--ph-color-accent);
  color: var(--ph-color-text-on-accent);
}

.ph-button--primary:not(:disabled):hover {
  background-color: var(--ph-color-accent-hover);
}

.ph-button--primary:not(:disabled):active {
  background-color: var(--ph-color-accent-active);
}

.ph-button--secondary {
  background-color: var(--ph-color-surface-raised);
  border-color: var(--ph-color-border-strong);
  color: var(--ph-color-text-default);
}

.ph-button--secondary:not(:disabled):hover {
  background-color: var(--ph-color-surface-hover);
}

.ph-button--secondary:not(:disabled):active {
  background-color: var(--ph-color-surface-active);
}

.ph-button--ghost {
  background-color: transparent;
  color: var(--ph-color-text-default);
}

.ph-button--ghost:not(:disabled):hover {
  background-color: var(--ph-color-surface-hover);
}

.ph-button--ghost:not(:disabled):active {
  background-color: var(--ph-color-surface-active);
}

.ph-button--danger {
  background-color: var(--ph-color-danger);
  color: var(--ph-color-text-on-accent);
}

.ph-button--danger:not(:disabled):hover {
  background-color: var(--ph-color-danger-hover);
}

.ph-button--danger:not(:disabled):active {
  background-color: var(--ph-color-danger-active);
}

.ph-button__spinner {
  position: absolute;
}

.ph-button__content {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-2);
}

.ph-button__content--hidden {
  visibility: hidden;
}
</style>
