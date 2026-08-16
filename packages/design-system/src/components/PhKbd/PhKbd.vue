<script setup lang="ts"></script>

<template>
  <kbd class="ph-kbd">
    <slot />
  </kbd>
</template>

<style scoped>
.ph-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  padding: 0 var(--ph-space-1);
  background-color: var(--ph-color-surface-sunken);
  border: 1px solid var(--ph-color-border-strong);
  border-bottom-width: 2px;
  border-radius: var(--ph-radius-sm);
  color: var(--ph-color-text-muted);
  font-family: var(--ph-font-family-mono);
  font-size: var(--ph-font-size-xs);
  line-height: 1.6;
}
</style>
