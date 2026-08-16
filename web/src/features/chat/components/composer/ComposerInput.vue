<script setup lang="ts">
import { ref } from 'vue';
import { PhTextarea } from '@phishyhub/design-system';
import MentionAutocomplete from './MentionAutocomplete.vue';
import { mentionToken } from '../../../../lib/mentions';
import type { UserDTO } from '../../../../api/types';

/**
 * Owns the textarea + `@` mention-trigger detection. PhTextarea doesn't
 * expose its internal `<textarea>` ref, but it also doesn't declare
 * `keydown`/`keyup`/`click`/`input` as emits — Vue's attrs fallthrough
 * attaches those as ordinary native listeners on its root element, which is
 * what lets this component read `event.target.selectionStart` directly.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string;
    disabled?: boolean;
    placeholder?: string;
  }>(),
  { disabled: false, placeholder: 'Message…' },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  submit: [];
  typing: [];
  blur: [];
}>();

const mentionQuery = ref<string | null>(null);
let mentionStart = -1;
const autocompleteRef = ref<InstanceType<typeof MentionAutocomplete> | null>(null);

function updateMentionState(text: string, caret: number): void {
  const upToCaret = text.slice(0, caret);
  const match = /(?:^|\s)@([^\s@]{0,32})$/.exec(upToCaret);
  if (match) {
    mentionQuery.value = match[1];
    mentionStart = caret - match[1].length - 1;
  } else {
    mentionQuery.value = null;
    mentionStart = -1;
  }
}

function onInput(event: Event): void {
  const target = event.target as HTMLTextAreaElement;
  emit('typing');
  updateMentionState(target.value, target.selectionStart ?? target.value.length);
}

function onCaretMoved(event: Event): void {
  const target = event.target as HTMLTextAreaElement;
  updateMentionState(target.value, target.selectionStart ?? target.value.length);
}

function onSelectMention(user: UserDTO): void {
  if (mentionStart < 0) return;
  const caret = mentionStart + 1 + (mentionQuery.value?.length ?? 0);
  const before = props.modelValue.slice(0, mentionStart);
  const after = props.modelValue.slice(caret);
  emit('update:modelValue', `${before}${mentionToken(user.id)} ${after}`);
  mentionQuery.value = null;
  mentionStart = -1;
}

function onKeydown(event: KeyboardEvent): void {
  if (mentionQuery.value !== null) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      autocompleteRef.value?.moveNext();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      autocompleteRef.value?.movePrev();
      return;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      if (autocompleteRef.value?.selectActive()) {
        event.preventDefault();
        return;
      }
    }
    if (event.key === 'Escape') {
      mentionQuery.value = null;
      mentionStart = -1;
      return;
    }
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    emit('submit');
  }
}
</script>

<template>
  <div class="composer-input">
    <div v-if="mentionQuery !== null" class="composer-input__mentions">
      <MentionAutocomplete ref="autocompleteRef" :query="mentionQuery" @select="onSelectMention" />
    </div>
    <PhTextarea
      :model-value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      auto-grow
      :rows="1"
      @update:model-value="emit('update:modelValue', $event)"
      @input="onInput"
      @keydown="onKeydown"
      @keyup="onCaretMoved"
      @click="onCaretMoved"
      @blur="emit('blur')"
    />
  </div>
</template>

<style scoped>
.composer-input {
  position: relative;
}

.composer-input__mentions {
  position: absolute;
  bottom: 100%;
  left: 0;
  z-index: 20;
  margin-bottom: var(--ph-space-1);
  max-height: 200px;
  overflow-y: auto;
  padding: var(--ph-space-1);
  background-color: var(--ph-color-surface-overlay);
  border: 1px solid var(--ph-color-border-subtle);
  border-radius: var(--ph-radius-md);
  box-shadow: var(--ph-shadow-md);
}
</style>
