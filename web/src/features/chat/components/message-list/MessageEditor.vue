<script setup lang="ts">
import { ref } from 'vue';
import { PhButton, PhTextarea } from '@phishyhub/design-system';

const props = defineProps<{
  initialBody: string;
  saving?: boolean;
}>();

const emit = defineEmits<{
  save: [body: string];
  cancel: [];
}>();

const draft = ref(props.initialBody);

function onSave(): void {
  const trimmed = draft.value.trim();
  if (!trimmed) return;
  emit('save', trimmed);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    onSave();
  } else if (event.key === 'Escape') {
    emit('cancel');
  }
}
</script>

<template>
  <div class="message-editor">
    <PhTextarea v-model="draft" auto-grow :rows="1" :disabled="saving" @keydown="onKeydown" />
    <div class="message-editor__actions">
      <span class="message-editor__hint">Enter to save &middot; Esc to cancel</span>
      <PhButton size="sm" variant="ghost" :disabled="saving" @click="emit('cancel')">Cancel</PhButton>
      <PhButton size="sm" :loading="saving" :disabled="!draft.trim()" @click="onSave">Save</PhButton>
    </div>
  </div>
</template>

<style scoped>
.message-editor {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-2);
  max-width: 480px;
}

.message-editor__actions {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
}

.message-editor__hint {
  margin-right: auto;
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
}
</style>
