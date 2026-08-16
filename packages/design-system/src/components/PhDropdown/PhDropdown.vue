<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useClickOutside } from '../../composables/useClickOutside';

export type DropdownAlign = 'start' | 'end';

const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    align?: DropdownAlign;
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
const contentRef = ref<HTMLElement | null>(null);
const rootRef = ref<HTMLElement | null>(null);
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

function open(): void {
  emit('update:modelValue', true);
}

function close(): void {
  emit('update:modelValue', false);
  triggerRef.value?.focus();
}

function toggle(): void {
  props.modelValue ? close() : open();
}

function getMenuItems(): HTMLElement[] {
  const content = contentRef.value;
  if (!content) return [];
  return Array.from(content.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
}

function focusItem(index: number): void {
  const items = getMenuItems();
  if (items.length === 0) return;
  const clamped = ((index % items.length) + items.length) % items.length;
  items[clamped]?.focus();
}

function onContentKeydown(event: KeyboardEvent): void {
  const items = getMenuItems();
  const currentIndex = items.indexOf(document.activeElement as HTMLElement);

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      focusItem(currentIndex + 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      focusItem(currentIndex - 1);
      break;
    case 'Home':
      event.preventDefault();
      focusItem(0);
      break;
    case 'End':
      event.preventDefault();
      focusItem(items.length - 1);
      break;
    case 'Escape':
      event.preventDefault();
      close();
      break;
    case 'Tab':
      close();
      break;
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
      focusItem(0);
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
  <div ref="rootRef" class="ph-dropdown">
    <div ref="triggerRef" class="ph-dropdown__trigger" @click="toggle">
      <slot name="trigger" :open="modelValue" :toggle="toggle" />
    </div>
    <Teleport to="body">
      <Transition name="ph-dropdown-content">
        <div
          v-if="modelValue"
          ref="contentRef"
          class="ph-dropdown__content"
          role="menu"
          :style="{ top: `${position.top}px`, left: `${position.left}px` }"
          :class="`ph-dropdown__content--${align}`"
          @keydown="onContentKeydown"
        >
          <slot :close="close" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.ph-dropdown {
  display: inline-block;
}

.ph-dropdown__trigger {
  display: inline-flex;
}

.ph-dropdown__content {
  position: absolute;
  z-index: 1100;
  min-width: 180px;
  margin-top: var(--ph-space-1);
  padding: var(--ph-space-1);
  background-color: var(--ph-color-glass-surface);
  backdrop-filter: var(--ph-glass-blur);
  -webkit-backdrop-filter: var(--ph-glass-blur);
  border: 1px solid var(--ph-color-glass-border);
  border-radius: var(--ph-radius-md);
  box-shadow: var(--ph-shadow-md);
}

.ph-dropdown__content--end {
  transform: translateX(-100%);
}

.ph-dropdown-content-enter-active {
  transition:
    opacity var(--ph-duration-fast) var(--ph-ease-out),
    transform var(--ph-duration-fast) var(--ph-ease-out);
}

.ph-dropdown-content-leave-active {
  transition:
    opacity var(--ph-duration-fast) var(--ph-ease-in),
    transform var(--ph-duration-fast) var(--ph-ease-in);
}

.ph-dropdown-content-enter-from,
.ph-dropdown-content-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.ph-dropdown__content--end.ph-dropdown-content-enter-from,
.ph-dropdown__content--end.ph-dropdown-content-leave-to {
  transform: translate(-100%, -4px);
}
</style>
