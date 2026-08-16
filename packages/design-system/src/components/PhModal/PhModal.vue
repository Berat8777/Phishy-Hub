<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useFocusTrap } from '../../composables/useFocusTrap';
import { useId } from '../../composables/useId';
import PhIcon from '../PhIcon/PhIcon.vue';

export type ModalSize = 'sm' | 'md' | 'lg';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    size?: ModalSize;
    /** Closing via Escape or backdrop click; set false for a "must choose" dialog. */
    closable?: boolean;
  }>(),
  {
    title: undefined,
    size: 'md',
    closable: true,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const dialogRef = ref<HTMLElement | null>(null);
const titleId = useId('modal-title');

function close(): void {
  if (!props.closable) return;
  emit('update:modelValue', false);
  emit('close');
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation();
    close();
  }
}

function onBackdropClick(): void {
  close();
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      document.addEventListener('keydown', onKeydown, true);
    } else {
      document.removeEventListener('keydown', onKeydown, true);
    }
  },
);

onMounted(() => {
  if (props.modelValue) {
    document.addEventListener('keydown', onKeydown, true);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown, true);
});

useFocusTrap(dialogRef);
</script>

<template>
  <Teleport to="body">
    <Transition name="ph-modal">
      <div v-if="modelValue" class="ph-modal__backdrop" @mousedown.self="onBackdropClick">
        <div
          ref="dialogRef"
          class="ph-modal"
          :class="`ph-modal--${size}`"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
          tabindex="-1"
        >
          <header v-if="title || closable" class="ph-modal__header">
            <h2 v-if="title" :id="titleId" class="ph-modal__title">{{ title }}</h2>
            <button v-if="closable" type="button" class="ph-modal__close" aria-label="Close" @click="close">
              <PhIcon name="X" size="sm" />
            </button>
          </header>
          <div class="ph-modal__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="ph-modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ph-modal__backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ph-space-5);
  background-color: var(--ph-color-overlay-scrim);
}

.ph-modal {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - var(--ph-space-8));
  width: 100%;
  background-color: var(--ph-color-surface-overlay);
  border-radius: var(--ph-radius-lg);
  box-shadow: var(--ph-shadow-lg);
}

.ph-modal:focus-visible {
  outline: none;
}

.ph-modal--sm {
  max-width: 400px;
}

.ph-modal--md {
  max-width: 560px;
}

.ph-modal--lg {
  max-width: 800px;
}

.ph-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ph-space-3);
  padding: var(--ph-space-4) var(--ph-space-5);
  border-bottom: 1px solid var(--ph-color-border-subtle);
}

.ph-modal__title {
  font-size: var(--ph-font-size-lg);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.ph-modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-muted);
}

.ph-modal__close:hover {
  background-color: var(--ph-color-surface-hover);
}

.ph-modal__close:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
}

.ph-modal__body {
  padding: var(--ph-space-5);
  overflow-y: auto;
  color: var(--ph-color-text-default);
}

.ph-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--ph-space-3);
  padding: var(--ph-space-4) var(--ph-space-5);
  border-top: 1px solid var(--ph-color-border-subtle);
}

.ph-modal-enter-active,
.ph-modal-leave-active {
  transition: opacity var(--ph-duration-base) var(--ph-easing-standard);
}

.ph-modal-enter-active .ph-modal,
.ph-modal-leave-active .ph-modal {
  transition: transform var(--ph-duration-base) var(--ph-easing-standard);
}

.ph-modal-enter-from,
.ph-modal-leave-to {
  opacity: 0;
}

.ph-modal-enter-from .ph-modal,
.ph-modal-leave-to .ph-modal {
  transform: scale(0.96) translateY(8px);
}
</style>
