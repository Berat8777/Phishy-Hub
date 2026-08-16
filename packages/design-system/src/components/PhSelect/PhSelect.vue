<script setup lang="ts">
export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

withDefaults(
  defineProps<{
    modelValue?: string;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    invalid?: boolean;
    id?: string;
  }>(),
  {
    modelValue: '',
    placeholder: undefined,
    disabled: false,
    invalid: false,
    id: undefined,
  },
);

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <div class="ph-select" :class="{ 'ph-select--invalid': invalid }">
    <select
      :id="id"
      class="ph-select__control"
      :value="modelValue"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder" value="" disabled hidden>{{ placeholder }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value" :disabled="option.disabled">
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.ph-select {
  position: relative;
}

.ph-select__control {
  width: 100%;
  height: 40px;
  padding: 0 var(--ph-space-6) 0 var(--ph-space-3);
  background-color: var(--ph-color-surface-raised);
  border: 1px solid var(--ph-color-border-strong);
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-default);
  font-size: var(--ph-font-size-md);
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--ph-space-3) center;
  transition:
    border-color var(--ph-duration-fast) var(--ph-easing-standard),
    box-shadow var(--ph-duration-fast) var(--ph-easing-standard);
}

.ph-select__control:hover:not(:disabled) {
  border-color: var(--ph-color-border-focus);
}

.ph-select__control:focus-visible {
  outline: none;
  border-color: var(--ph-color-border-focus);
  box-shadow: var(--ph-focus-ring);
}

.ph-select__control:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.ph-select--invalid .ph-select__control {
  border-color: var(--ph-color-danger);
}
</style>
