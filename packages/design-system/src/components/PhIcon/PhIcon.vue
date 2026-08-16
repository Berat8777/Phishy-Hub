<script setup lang="ts">
import { computed } from 'vue';
import * as icons from 'lucide-vue-next';
import type { LucideProps } from 'lucide-vue-next';

export type IconName = Exclude<keyof typeof icons, 'default' | 'createLucideIcon' | 'icons'>;

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<IconSize, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

const props = withDefaults(
  defineProps<{
    /** Lucide icon component name, e.g. "ArrowRight", "Check", "X". */
    name: IconName;
    size?: IconSize;
    /** CSS color value, typically `var(--ph-color-*)`. Defaults to currentColor. */
    color?: string;
    strokeWidth?: number;
  }>(),
  {
    size: 'md',
    color: undefined,
    strokeWidth: 2,
  },
);

const iconComponent = computed(() => icons[props.name as keyof typeof icons] as unknown as LucideProps);
const pixelSize = computed(() => SIZE_MAP[props.size]);
</script>

<template>
  <component
    :is="iconComponent"
    class="ph-icon"
    :size="pixelSize"
    :stroke-width="strokeWidth"
    :color="color ?? 'currentColor'"
    aria-hidden="true"
  />
</template>

<style scoped>
.ph-icon {
  display: inline-block;
  flex-shrink: 0;
}
</style>
