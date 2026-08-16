<script setup lang="ts">
import { computed } from 'vue';
import { PhDivider } from '@phishyhub/design-system';
import { formatDayLabel } from '../../../../lib/date';

const props = defineProps<{ date: string }>();
const label = computed(() => formatDayLabel(props.date));
</script>

<template>
  <div class="day-divider">
    <PhDivider>{{ label }}</PhDivider>
  </div>
</template>

<style scoped>
.day-divider {
  padding: var(--ph-space-2) var(--ph-space-4);
}
</style>
