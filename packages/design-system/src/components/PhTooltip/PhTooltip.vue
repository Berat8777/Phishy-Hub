<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { useId } from '../../composables/useId';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

const props = withDefaults(
  defineProps<{
    text: string;
    placement?: TooltipPlacement;
    disabled?: boolean;
  }>(),
  {
    placement: 'top',
    disabled: false,
  },
);

const triggerRef = ref<HTMLElement | null>(null);
const visible = ref(false);
const position = ref({ top: 0, left: 0 });
const tooltipId = useId('tooltip');

function updatePosition(): void {
  const trigger = triggerRef.value;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const gap = 8;

  switch (props.placement) {
    case 'bottom':
      position.value = { top: rect.bottom + window.scrollY + gap, left: rect.left + window.scrollX + rect.width / 2 };
      break;
    case 'left':
      position.value = { top: rect.top + window.scrollY + rect.height / 2, left: rect.left + window.scrollX - gap };
      break;
    case 'right':
      position.value = { top: rect.top + window.scrollY + rect.height / 2, left: rect.right + window.scrollX + gap };
      break;
    default:
      position.value = { top: rect.top + window.scrollY - gap, left: rect.left + window.scrollX + rect.width / 2 };
  }
}

async function show(): Promise<void> {
  if (props.disabled || !props.text) return;
  visible.value = true;
  await nextTick();
  updatePosition();
}

function hide(): void {
  visible.value = false;
}
</script>

<template>
  <span
    ref="triggerRef"
    class="ph-tooltip-trigger"
    :aria-describedby="visible ? tooltipId : undefined"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
    @keydown.escape="hide"
  >
    <slot />
    <Teleport to="body">
      <div
        v-if="visible"
        :id="tooltipId"
        class="ph-tooltip"
        :class="`ph-tooltip--${placement}`"
        role="tooltip"
        :style="{ top: `${position.top}px`, left: `${position.left}px` }"
      >
        {{ text }}
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.ph-tooltip-trigger {
  display: inline-flex;
}

.ph-tooltip {
  position: absolute;
  z-index: 1200;
  max-width: 240px;
  padding: var(--ph-space-1) var(--ph-space-2);
  background-color: var(--ph-color-surface-inverse);
  color: var(--ph-color-text-inverse);
  font-size: var(--ph-font-size-xs);
  border-radius: var(--ph-radius-sm);
  box-shadow: var(--ph-shadow-sm);
  pointer-events: none;
}

.ph-tooltip--top {
  transform: translate(-50%, -100%);
}

.ph-tooltip--bottom {
  transform: translate(-50%, 0);
}

.ph-tooltip--left {
  transform: translate(-100%, -50%);
}

.ph-tooltip--right {
  transform: translate(0, -50%);
}
</style>
