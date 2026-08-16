<script setup lang="ts">
import { useId } from '../../composables/useId';
import PhIcon from '../PhIcon/PhIcon.vue';

const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    disabled?: boolean;
    indeterminate?: boolean;
    id?: string;
  }>(),
  {
    modelValue: false,
    disabled: false,
    indeterminate: false,
    id: undefined,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const inputId = props.id ?? useId('checkbox');

function onChange(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).checked);
}
</script>

<template>
  <label class="ph-checkbox" :class="{ 'ph-checkbox--disabled': disabled }" :for="inputId">
    <span class="ph-checkbox__box">
      <input
        :id="inputId"
        class="ph-checkbox__input"
        type="checkbox"
        :checked="modelValue"
        :disabled="disabled"
        :aria-checked="indeterminate ? 'mixed' : modelValue"
        @change="onChange"
      />
      <PhIcon
        v-if="modelValue && !indeterminate"
        name="Check"
        size="xs"
        color="var(--ph-color-text-on-accent)"
        class="ph-checkbox__icon"
      />
      <PhIcon
        v-else-if="indeterminate"
        name="Minus"
        size="xs"
        color="var(--ph-color-text-on-accent)"
        class="ph-checkbox__icon"
      />
    </span>
    <span v-if="$slots.default" class="ph-checkbox__label"><slot /></span>
  </label>
</template>

<style scoped>
.ph-checkbox {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-2);
  cursor: pointer;
  user-select: none;
}

.ph-checkbox--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.ph-checkbox__box {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  background-color: var(--ph-color-surface-raised);
  border: 1px solid var(--ph-color-border-strong);
  border-radius: var(--ph-radius-sm);
  transition: background-color var(--ph-duration-fast) var(--ph-easing-standard);
}

.ph-checkbox__input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: inherit;
}

.ph-checkbox__input:checked + .ph-checkbox__icon,
.ph-checkbox__icon {
  pointer-events: none;
}

.ph-checkbox__input:focus-visible ~ .ph-checkbox__icon {
  outline: none;
}

.ph-checkbox:has(.ph-checkbox__input:checked) .ph-checkbox__box,
.ph-checkbox:has(.ph-checkbox__input[aria-checked='mixed']) .ph-checkbox__box {
  background-color: var(--ph-color-accent);
  border-color: var(--ph-color-accent);
}

.ph-checkbox:has(.ph-checkbox__input:focus-visible) .ph-checkbox__box {
  box-shadow: var(--ph-focus-ring);
}

.ph-checkbox__label {
  font-size: var(--ph-font-size-md);
  color: var(--ph-color-text-default);
}
</style>
