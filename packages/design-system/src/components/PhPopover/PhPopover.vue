<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useClickOutside } from '../../composables/useClickOutside';

export type PopoverAlign = 'start' | 'end';

const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    align?: PopoverAlign;
  }>(),
  {
    modelValue: false,
    align: 'start',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const triggerRef = ref<HTMLElement | null>(null);
const rootRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const position = ref({ top: 0, left: 0 });

function updatePosition(): void {
  const trigger = triggerRef.value;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  position.value =
    props.align === 'end'
      ? { top: rect.bottom + window.scrollY, left: rect.right + window.scrollX }
      : { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX };
}

function close(): void {
  emit('update:modelValue', false);
}

function toggle(): void {
  emit('update:modelValue', !props.modelValue);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    triggerRef.value?.focus();
  }
}

function addPositionListeners(): void {
  window.addEventListener('resize', updatePosition);
  window.addEventListener('scroll', updatePosition, true);
}

function removePositionListeners(): void {
  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('scroll', updatePosition, true);
}

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      updatePosition();
      addPositionListeners();
    } else {
      removePositionListeners();
    }
  },
);

onBeforeUnmount(removePositionListeners);

useClickOutside([rootRef, contentRef], () => {
  if (props.modelValue) close();
});
</script>

<template>
  <div ref="rootRef" class="ph-popover">
    <div ref="triggerRef" class="ph-popover__trigger" @click="toggle">
      <slot name="trigger" :open="modelValue" :toggle="toggle" />
    </div>
    <Teleport to="body">
      <Transition name="ph-popover-content">
        <div
          v-if="modelValue"
          ref="contentRef"
          class="ph-popover__content"
          :class="`ph-popover__content--${align}`"
          role="dialog"
          :style="{ top: `${position.top}px`, left: `${position.left}px` }"
          @keydown="onKeydown"
        >
          <slot :close="close" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.ph-popover {
  display: inline-block;
}

.ph-popover__trigger {
  display: inline-flex;
}

.ph-popover__content {
  position: absolute;
  z-index: 1100;
  margin-top: var(--ph-space-2);
  padding: var(--ph-space-4);
  min-width: 240px;
  background-color: var(--ph-color-glass-surface);
  backdrop-filter: var(--ph-glass-blur);
  -webkit-backdrop-filter: var(--ph-glass-blur);
  border: 1px solid var(--ph-color-glass-border);
  border-radius: var(--ph-radius-lg);
  box-shadow: var(--ph-shadow-md);
}

.ph-popover__content--end {
  transform: translateX(-100%);
}

.ph-popover-content-enter-active {
  transition:
    opacity var(--ph-duration-fast) var(--ph-ease-out),
    transform var(--ph-duration-fast) var(--ph-ease-out);
}

.ph-popover-content-leave-active {
  transition:
    opacity var(--ph-duration-fast) var(--ph-ease-in),
    transform var(--ph-duration-fast) var(--ph-ease-in);
}

.ph-popover-content-enter-from,
.ph-popover-content-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.ph-popover__content--end.ph-popover-content-enter-from,
.ph-popover__content--end.ph-popover-content-leave-to {
  transform: translate(-100%, -4px);
}
</style>
