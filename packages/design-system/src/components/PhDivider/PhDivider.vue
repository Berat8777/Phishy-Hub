<script setup lang="ts">
withDefaults(
  defineProps<{
    orientation?: 'horizontal' | 'vertical';
  }>(),
  {
    orientation: 'horizontal',
  },
);
</script>

<template>
  <div
    v-if="$slots.default"
    class="ph-divider ph-divider--with-label"
    :class="`ph-divider--${orientation}`"
    role="separator"
  >
    <span class="ph-divider__line" />
    <span class="ph-divider__label"><slot /></span>
    <span class="ph-divider__line" />
  </div>
  <div v-else class="ph-divider" :class="`ph-divider--${orientation}`" role="separator" />
</template>

<style scoped>
.ph-divider--horizontal {
  width: 100%;
  height: 1px;
  background-color: var(--ph-color-border-subtle);
}

.ph-divider--vertical {
  width: 1px;
  align-self: stretch;
  background-color: var(--ph-color-border-subtle);
}

.ph-divider--with-label {
  display: flex;
  align-items: center;
  gap: var(--ph-space-3);
  width: 100%;
  height: auto;
  background: none;
}

.ph-divider--with-label .ph-divider__line {
  flex: 1;
  height: 1px;
  background-color: var(--ph-color-border-subtle);
}

.ph-divider__label {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-muted);
  white-space: nowrap;
}
</style>
