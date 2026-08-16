<script setup lang="ts">
import { CURATED_EMOJI } from '../../../../lib/emoji';

const emit = defineEmits<{ select: [emoji: string] }>();
</script>

<template>
  <div class="emoji-picker" role="listbox" aria-label="Choose an emoji">
    <button
      v-for="emoji in CURATED_EMOJI"
      :key="emoji"
      type="button"
      class="emoji-picker__item"
      role="option"
      @click="emit('select', emoji)"
    >
      {{ emoji }}
    </button>
  </div>
</template>

<style scoped>
.emoji-picker {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--ph-space-1);
  width: 208px;
}

.emoji-picker__item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--ph-radius-md);
  font-size: var(--ph-font-size-lg);
  line-height: 1;
}

.emoji-picker__item:hover {
  background-color: var(--ph-color-surface-hover);
}

.emoji-picker__item:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
}
</style>
