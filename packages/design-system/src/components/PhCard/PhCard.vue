<script setup lang="ts">
withDefaults(
  defineProps<{
    padded?: boolean;
  }>(),
  {
    padded: true,
  },
);
</script>

<template>
  <div class="ph-card" :class="{ 'ph-card--padded': padded }">
    <div v-if="$slots.header" class="ph-card__header">
      <slot name="header" />
    </div>
    <div class="ph-card__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="ph-card__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.ph-card {
  background-color: var(--ph-color-surface-raised);
  border: 1px solid var(--ph-color-border-subtle);
  border-radius: var(--ph-radius-lg);
  box-shadow: var(--ph-shadow-sm);
}

.ph-card__header {
  padding: var(--ph-space-4) var(--ph-space-4) 0;
}

.ph-card__footer {
  padding: 0 var(--ph-space-4) var(--ph-space-4);
}

.ph-card--padded .ph-card__body {
  padding: var(--ph-space-4);
}

.ph-card--padded .ph-card__header + .ph-card__body {
  padding-top: var(--ph-space-3);
}
</style>
