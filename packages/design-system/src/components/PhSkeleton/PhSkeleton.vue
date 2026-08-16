<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string;
    height?: string;
    radius?: 'sm' | 'md' | 'lg' | 'full';
  }>(),
  {
    width: '100%',
    height: '16px',
    radius: 'sm',
  },
);
</script>

<template>
  <span
    class="ph-skeleton"
    :class="`ph-skeleton--${radius}`"
    :style="{ width, height }"
    aria-hidden="true"
  />
</template>

<style scoped>
.ph-skeleton {
  display: block;
  background: linear-gradient(
    90deg,
    var(--ph-color-surface-sunken) 25%,
    var(--ph-color-surface-hover) 37%,
    var(--ph-color-surface-sunken) 63%
  );
  background-size: 400% 100%;
  animation: ph-skeleton-shimmer 1.4s ease infinite;
}

.ph-skeleton--sm {
  border-radius: var(--ph-radius-sm);
}

.ph-skeleton--md {
  border-radius: var(--ph-radius-md);
}

.ph-skeleton--lg {
  border-radius: var(--ph-radius-lg);
}

.ph-skeleton--full {
  border-radius: var(--ph-radius-full);
}

@keyframes ph-skeleton-shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ph-skeleton {
    animation: none;
  }
}
</style>
