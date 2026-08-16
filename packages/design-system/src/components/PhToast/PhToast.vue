<script setup lang="ts">
import type { Toast } from '../../composables/useToast';
import PhIcon from '../PhIcon/PhIcon.vue';
import type { IconName } from '../PhIcon/PhIcon.vue';

const props = defineProps<{
  toast: Toast;
}>();

defineEmits<{
  dismiss: [];
}>();

const VARIANT_ICON: Record<Toast['variant'], IconName> = {
  default: 'Info',
  success: 'CircleCheck',
  danger: 'CircleAlert',
  warning: 'TriangleAlert',
};
</script>

<template>
  <div class="ph-toast" :class="`ph-toast--${toast.variant}`" role="status">
    <PhIcon :name="VARIANT_ICON[toast.variant]" size="sm" class="ph-toast__icon" />
    <div class="ph-toast__body">
      <p class="ph-toast__title">{{ toast.title }}</p>
      <p v-if="toast.description" class="ph-toast__description">{{ toast.description }}</p>
    </div>
    <button type="button" class="ph-toast__dismiss" aria-label="Dismiss" @click="$emit('dismiss')">
      <PhIcon name="X" size="xs" />
    </button>
  </div>
</template>

<style scoped>
.ph-toast {
  display: flex;
  align-items: flex-start;
  gap: var(--ph-space-2);
  width: 320px;
  max-width: 100%;
  padding: var(--ph-space-3) var(--ph-space-3);
  background-color: var(--ph-color-surface-overlay);
  border: 1px solid var(--ph-color-border-subtle);
  border-radius: var(--ph-radius-md);
  box-shadow: var(--ph-shadow-lg);
}

.ph-toast__icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--ph-color-text-muted);
}

.ph-toast--success .ph-toast__icon {
  color: var(--ph-color-success);
}

.ph-toast--danger .ph-toast__icon {
  color: var(--ph-color-danger);
}

.ph-toast--warning .ph-toast__icon {
  color: var(--ph-color-warning);
}

.ph-toast__body {
  flex: 1;
  min-width: 0;
}

.ph-toast__title {
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.ph-toast__description {
  margin-top: var(--ph-space-1);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}

.ph-toast__dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: var(--ph-radius-sm);
  color: var(--ph-color-text-muted);
}

.ph-toast__dismiss:hover {
  background-color: var(--ph-color-surface-hover);
}

.ph-toast__dismiss:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
}
</style>
