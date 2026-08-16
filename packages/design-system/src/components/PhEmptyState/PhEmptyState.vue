<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description?: string;
  }>(),
  {
    description: undefined,
  },
);
</script>

<template>
  <div class="ph-empty-state">
    <div v-if="$slots.icon" class="ph-empty-state__icon">
      <slot name="icon" />
    </div>
    <p class="ph-empty-state__title">{{ title }}</p>
    <p v-if="description" class="ph-empty-state__description">{{ description }}</p>
    <div v-if="$slots.action" class="ph-empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.ph-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-8) var(--ph-space-5);
  text-align: center;
  color: var(--ph-color-text-muted);
}

.ph-empty-state__icon {
  margin-bottom: var(--ph-space-2);
  color: var(--ph-color-text-subtle);
}

.ph-empty-state__title {
  font-size: var(--ph-font-size-md);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.ph-empty-state__description {
  max-width: 40ch;
  font-size: var(--ph-font-size-sm);
}

.ph-empty-state__action {
  margin-top: var(--ph-space-3);
}
</style>
