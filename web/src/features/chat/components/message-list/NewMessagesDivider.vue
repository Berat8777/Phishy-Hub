<script setup lang="ts"></script>

<template>
  <div class="new-messages-divider" role="separator">
    <span class="new-messages-divider__line" />
    <span class="new-messages-divider__label">New messages</span>
    <span class="new-messages-divider__line" />
  </div>
</template>

<style scoped>
.new-messages-divider {
  display: flex;
  align-items: center;
  gap: var(--ph-space-3);
  padding: var(--ph-space-2) var(--ph-space-4);
}

.new-messages-divider__line {
  flex: 1;
  height: 1px;
  background-color: var(--ph-color-danger);
  opacity: 0.4;
}

.new-messages-divider__label {
  font-size: var(--ph-font-size-xs);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-danger);
  white-space: nowrap;
}
</style>
