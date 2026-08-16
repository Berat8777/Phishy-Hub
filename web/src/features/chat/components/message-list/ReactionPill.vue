<script setup lang="ts">
defineProps<{
  emoji: string;
  count: number;
  reactedByMe: boolean;
}>();

const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    type="button"
    class="reaction-pill"
    :class="{ 'reaction-pill--active': reactedByMe }"
    :aria-pressed="reactedByMe"
    @click="emit('toggle')"
  >
    <span>{{ emoji }}</span>
    <span class="reaction-pill__count">{{ count }}</span>
  </button>
</template>

<style scoped>
.reaction-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-1);
  height: 22px;
  padding: 0 var(--ph-space-2);
  border-radius: var(--ph-radius-full);
  border: 1px solid var(--ph-color-border-subtle);
  background-color: var(--ph-color-surface-raised);
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-muted);
}

.reaction-pill:hover {
  border-color: var(--ph-color-border-focus);
}

.reaction-pill--active {
  background-color: var(--ph-color-accent-subtle);
  border-color: var(--ph-color-accent);
  color: var(--ph-color-accent-subtle-text);
}

.reaction-pill__count {
  font-weight: var(--ph-font-weight-medium);
}
</style>
