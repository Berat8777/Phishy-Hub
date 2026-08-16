<script setup lang="ts">
export type SpinnerSize = 'sm' | 'md' | 'lg';

withDefaults(
  defineProps<{
    size?: SpinnerSize;
    label?: string;
  }>(),
  {
    size: 'md',
    label: 'Loading',
  },
);
</script>

<template>
  <span class="ph-spinner" :class="`ph-spinner--${size}`" role="status">
    <svg class="ph-spinner__svg" viewBox="0 0 24 24" fill="none">
      <circle class="ph-spinner__track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
      <path
        class="ph-spinner__head"
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
      />
    </svg>
    <span class="ph-visually-hidden">{{ label }}</span>
  </span>
</template>

<style scoped>
.ph-spinner {
  display: inline-flex;
  color: currentColor;
}

.ph-spinner--sm {
  width: 16px;
  height: 16px;
}

.ph-spinner--md {
  width: 24px;
  height: 24px;
}

.ph-spinner--lg {
  width: 32px;
  height: 32px;
}

.ph-spinner__svg {
  width: 100%;
  height: 100%;
  animation: ph-spinner-rotate 0.8s linear infinite;
}

.ph-spinner__track {
  opacity: 0.25;
}

.ph-spinner__head {
  opacity: 0.9;
}

@keyframes ph-spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ph-spinner__svg {
    animation-duration: 1.6s;
  }
}
</style>
