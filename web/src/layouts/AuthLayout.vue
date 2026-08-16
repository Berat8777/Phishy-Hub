<script setup lang="ts">
import { PhCard } from '@phishyhub/design-system';
</script>

<template>
  <div class="auth-layout">
    <div class="auth-layout__brand">
      <h1>Phishy Hub</h1>
    </div>
    <PhCard class="auth-layout__card">
      <slot />
    </PhCard>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--ph-space-5);
  padding: var(--ph-space-5);
  background-color: var(--ph-color-bg-canvas);
  background-image: radial-gradient(circle at 20% 20%, var(--ph-color-accent-subtle), transparent 45%),
    radial-gradient(circle at 80% 75%, var(--ph-color-accent-subtle), transparent 40%);
}

.auth-layout__brand h1 {
  margin: 0;
  font-size: var(--ph-font-size-2xl);
  font-weight: var(--ph-font-weight-bold);
  color: var(--ph-color-text-default);
  animation: ph-auth-in var(--ph-duration-base) var(--ph-ease-out);
}

.auth-layout__card {
  width: 100%;
  max-width: 400px;
  animation: ph-auth-in var(--ph-duration-base) var(--ph-ease-out);
}

@keyframes ph-auth-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
