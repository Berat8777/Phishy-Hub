<script setup lang="ts">
import { computed } from 'vue';
import { usePresenceStore } from '../../../../stores/presence';

/** Reads the `presence` store only — never touches the socket directly (repo rule: components never call `socket.on`). */
const props = defineProps<{ userId: string }>();

const presenceStore = usePresenceStore();
const online = computed(() => presenceStore.isOnline(props.userId));
</script>

<template>
  <span class="presence-dot" :class="{ 'presence-dot--online': online }" :aria-label="online ? 'Online' : 'Offline'" />
</template>

<style scoped>
.presence-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: var(--ph-radius-full);
  background-color: var(--ph-color-text-subtle);
  border: 2px solid var(--ph-color-surface-raised);
}

.presence-dot--online {
  background-color: var(--ph-color-success);
}
</style>
