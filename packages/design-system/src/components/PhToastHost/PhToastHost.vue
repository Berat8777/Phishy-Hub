<script setup lang="ts">
import { useToast } from '../../composables/useToast';
import PhToast from '../PhToast/PhToast.vue';

export type ToastHostPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

withDefaults(
  defineProps<{
    position?: ToastHostPosition;
  }>(),
  {
    position: 'bottom-right',
  },
);

const { toasts, dismiss } = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="ph-toast-host" :class="`ph-toast-host--${position}`" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="ph-toast-host">
        <PhToast v-for="toast in toasts" :key="toast.id" :toast="toast" @dismiss="dismiss(toast.id)" />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.ph-toast-host {
  position: fixed;
  z-index: 1300;
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-2);
  padding: var(--ph-space-4);
  pointer-events: none;
}

.ph-toast-host :deep(.ph-toast) {
  pointer-events: auto;
}

.ph-toast-host--top-right {
  top: 0;
  right: 0;
  align-items: flex-end;
}

.ph-toast-host--top-left {
  top: 0;
  left: 0;
  align-items: flex-start;
}

.ph-toast-host--bottom-right {
  bottom: 0;
  right: 0;
  align-items: flex-end;
  flex-direction: column-reverse;
}

.ph-toast-host--bottom-left {
  bottom: 0;
  left: 0;
  align-items: flex-start;
  flex-direction: column-reverse;
}

.ph-toast-host-move,
.ph-toast-host-enter-active,
.ph-toast-host-leave-active {
  transition:
    transform var(--ph-duration-base) var(--ph-easing-standard),
    opacity var(--ph-duration-base) var(--ph-easing-standard);
}

.ph-toast-host-enter-from,
.ph-toast-host-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.ph-toast-host-leave-active {
  position: absolute;
}
</style>
