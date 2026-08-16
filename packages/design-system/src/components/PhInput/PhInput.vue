<script setup lang="ts">
export type InputType = 'text' | 'email' | 'password' | 'search' | 'number' | 'tel' | 'url';

withDefaults(
  defineProps<{
    modelValue?: string;
    type?: InputType;
    placeholder?: string;
    disabled?: boolean;
    invalid?: boolean;
    id?: string;
  }>(),
  {
    modelValue: '',
    type: 'text',
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
  <input
    :id="id"
    class="ph-input"
    :class="{ 'ph-input--invalid': invalid }"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :aria-invalid="invalid || undefined"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<style scoped>
.ph-input {
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

.ph-input::placeholder {
  color: var(--ph-color-text-subtle);
}

.ph-input:hover:not(:disabled) {
  border-color: var(--ph-color-border-focus);
}

.ph-input:focus-visible {
  outline: none;
  border-color: var(--ph-color-border-focus);
  box-shadow: var(--ph-focus-ring);
}

.ph-input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.ph-input--invalid {
  border-color: var(--ph-color-danger);
}

.ph-input--invalid:focus-visible {
  border-color: var(--ph-color-danger);
}
</style>
