<script setup lang="ts">
export type BadgeVariant = 'default' | 'accent' | 'cta' | 'success' | 'danger' | 'warning';

withDefaults(
  defineProps<{
    variant?: BadgeVariant;
  }>(),
  {
    variant: 'default',
  },
);
</script>

<template>
  <span class="ph-badge" :class="`ph-badge--${variant}`">
    <slot />
  </span>
</template>

<style scoped>
.ph-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ph-space-1);
  height: 20px;
  padding: 0 var(--ph-space-2);
  border-radius: var(--ph-radius-full);
  font-size: var(--ph-font-size-xs);
  font-weight: var(--ph-font-weight-semibold);
  line-height: 1;
  white-space: nowrap;
}

.ph-badge--default {
  background-color: var(--ph-color-surface-sunken);
  color: var(--ph-color-text-muted);
}

.ph-badge--accent {
  background-color: var(--ph-color-accent-subtle);
  color: var(--ph-color-accent-subtle-text);
}

/** Reserved for the sparing "CTA" highlight use case (e.g. unread counts) — not a general-purpose alternative to `accent`. */
.ph-badge--cta {
  background-color: var(--ph-color-cta-subtle);
  color: var(--ph-color-cta-subtle-text);
}

.ph-badge--success {
  background-color: var(--ph-color-success-subtle);
  color: var(--ph-color-success-subtle-text);
}

.ph-badge--danger {
  background-color: var(--ph-color-danger-subtle);
  color: var(--ph-color-danger-subtle-text);
}

.ph-badge--warning {
  background-color: var(--ph-color-warning-subtle);
  color: var(--ph-color-warning-subtle-text);
}
</style>
