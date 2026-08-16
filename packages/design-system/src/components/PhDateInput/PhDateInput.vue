<script setup lang="ts">
/**
 * Thin wrapper over `<input type="date">`, matching `PhInput`'s bare-control
 * chrome (this design system has no label/error/description wrapper on any
 * of its form controls today — that's composed by consumers). The native
 * date input already gives us a `'YYYY-MM-DD'` string; it's passed through
 * as-is and never wrapped in a JS `Date`, so date-only values stay
 * timezone-safe all the way down to the consumer.
 */
withDefaults(
  defineProps<{
    modelValue?: string;
    disabled?: boolean;
    invalid?: boolean;
    id?: string;
    /** 'YYYY-MM-DD' lower bound (native date input attribute). */
    min?: string;
    /** 'YYYY-MM-DD' upper bound (native date input attribute). */
    max?: string;
  }>(),
  {
    modelValue: '',
    disabled: false,
    invalid: false,
    id: undefined,
    min: undefined,
    max: undefined,
  },
);

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <input
    :id="id"
    class="ph-date-input"
    :class="{ 'ph-date-input--invalid': invalid }"
    type="date"
    :value="modelValue"
    :min="min"
    :max="max"
    :disabled="disabled"
    :aria-invalid="invalid || undefined"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<style scoped>
.ph-date-input {
  width: 100%;
  height: 40px;
  padding: 0 var(--ph-space-3);
  background-color: var(--ph-color-surface-raised);
  border: 1px solid var(--ph-color-border-strong);
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-default);
  font-size: var(--ph-font-size-md);
  transition:
    border-color var(--ph-duration-fast) var(--ph-easing-standard),
    box-shadow var(--ph-duration-fast) var(--ph-easing-standard);
}

.ph-date-input::-webkit-calendar-picker-indicator {
  cursor: pointer;
}

.ph-date-input:hover:not(:disabled) {
  border-color: var(--ph-color-border-focus);
}

.ph-date-input:focus-visible {
  outline: none;
  border-color: var(--ph-color-border-focus);
  box-shadow: var(--ph-focus-ring);
}

.ph-date-input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.ph-date-input--invalid {
  border-color: var(--ph-color-danger);
}

.ph-date-input--invalid:focus-visible {
  border-color: var(--ph-color-danger);
}
</style>
