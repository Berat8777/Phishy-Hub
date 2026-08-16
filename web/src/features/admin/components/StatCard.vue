<script setup lang="ts">
import { PhCard, PhSkeleton } from '@phishyhub/design-system';

defineProps<{ label: string; value?: number; loading?: boolean }>();
</script>

<template>
  <PhCard class="stat-card">
    <p class="stat-card__label">{{ label }}</p>
    <PhSkeleton v-if="loading" height="28px" width="60px" />
    <p v-else class="stat-card__value">{{ value ?? 0 }}</p>
  </PhCard>
</template>

<style scoped>
.stat-card {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-2);
  min-width: 140px;
}

.stat-card__label {
  margin: 0;
  font-size: var(--ph-font-size-xs);
  font-weight: var(--ph-font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ph-color-text-muted);
}

.stat-card__value {
  margin: 0;
  font-size: var(--ph-font-size-xl);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}
</style>
