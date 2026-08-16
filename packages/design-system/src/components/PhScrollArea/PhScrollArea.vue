<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Max height before the area scrolls; any valid CSS size (e.g. "100%", "480px"). */
    maxHeight?: string;
  }>(),
  {
    maxHeight: undefined,
  },
);
</script>

<template>
  <div class="ph-scroll-area" :style="maxHeight ? { maxHeight } : undefined">
    <slot />
  </div>
</template>

<style scoped>
.ph-scroll-area {
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--ph-color-border-strong) transparent;
}

.ph-scroll-area::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.ph-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}

.ph-scroll-area::-webkit-scrollbar-thumb {
  background-color: var(--ph-color-border-strong);
  border-radius: var(--ph-radius-full);
}
</style>
