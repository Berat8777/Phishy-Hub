<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
    disabled?: boolean;
    invalid?: boolean;
    id?: string;
    rows?: number;
    /** Grows the textarea to fit its content instead of scrolling. */
    autoGrow?: boolean;
  }>(),
  {
    modelValue: '',
    placeholder: undefined,
    disabled: false,
    invalid: false,
    id: undefined,
    rows: 3,
    autoGrow: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);

function resize(): void {
  if (!props.autoGrow) return;
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

function onInput(event: Event): void {
  const value = (event.target as HTMLTextAreaElement).value;
  emit('update:modelValue', value);
  resize();
}

watch(
  () => props.modelValue,
  () => nextTick(resize),
);

watch(
  () => props.autoGrow,
  (enabled) => {
    if (enabled) nextTick(resize);
  },
  { immediate: true },
);
</script>

<template>
  <textarea
    :id="id"
    ref="textareaRef"
    class="ph-textarea"
    :class="{ 'ph-textarea--invalid': invalid, 'ph-textarea--auto-grow': autoGrow }"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :rows="rows"
    :aria-invalid="invalid || undefined"
    @input="onInput"
  />
</template>

<style scoped>
.ph-textarea {
  width: 100%;
  padding: var(--ph-space-2) var(--ph-space-3);
  background-color: var(--ph-color-surface-raised);
  border: 1px solid var(--ph-color-border-strong);
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-default);
  font-family: var(--ph-font-family-base);
  font-size: var(--ph-font-size-md);
  resize: vertical;
  transition:
    border-color var(--ph-duration-fast) var(--ph-easing-standard),
    box-shadow var(--ph-duration-fast) var(--ph-easing-standard);
}

.ph-textarea--auto-grow {
  resize: none;
  overflow: hidden;
}

.ph-textarea::placeholder {
  color: var(--ph-color-text-subtle);
}

.ph-textarea:hover:not(:disabled) {
  border-color: var(--ph-color-border-focus);
}

.ph-textarea:focus-visible {
  outline: none;
  border-color: var(--ph-color-border-focus);
  box-shadow: var(--ph-focus-ring);
}

.ph-textarea:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.ph-textarea--invalid {
  border-color: var(--ph-color-danger);
}
</style>
