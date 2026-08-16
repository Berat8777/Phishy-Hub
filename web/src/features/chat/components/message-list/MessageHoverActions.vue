<script setup lang="ts">
import { ref } from 'vue';
import { PhIcon, PhPopover, PhTooltip } from '@phishyhub/design-system';
import EmojiPicker from './EmojiPicker.vue';

defineProps<{
  canEdit: boolean;
  allowThreadReply: boolean;
}>();

const emit = defineEmits<{
  react: [emoji: string];
  reply: [];
  edit: [];
  delete: [];
}>();

const pickerOpen = ref(false);

function onSelectEmoji(emoji: string): void {
  emit('react', emoji);
  pickerOpen.value = false;
}
</script>

<template>
  <div class="message-hover-actions" role="toolbar" aria-label="Message actions">
    <PhPopover v-model="pickerOpen" align="end">
      <template #trigger>
        <PhTooltip text="Add reaction">
          <span class="message-hover-actions__btn" role="button" tabindex="0" aria-label="Add reaction">
            <PhIcon name="Smile" size="sm" />
          </span>
        </PhTooltip>
      </template>
      <EmojiPicker @select="onSelectEmoji" />
    </PhPopover>

    <PhTooltip v-if="allowThreadReply" text="Reply in thread">
      <button type="button" class="message-hover-actions__btn" aria-label="Reply in thread" @click="emit('reply')">
        <PhIcon name="MessageSquare" size="sm" />
      </button>
    </PhTooltip>

    <PhTooltip v-if="canEdit" text="Edit">
      <button type="button" class="message-hover-actions__btn" aria-label="Edit message" @click="emit('edit')">
        <PhIcon name="Pencil" size="sm" />
      </button>
    </PhTooltip>

    <PhTooltip v-if="canEdit" text="Delete">
      <button
        type="button"
        class="message-hover-actions__btn message-hover-actions__btn--danger"
        aria-label="Delete message"
        @click="emit('delete')"
      >
        <PhIcon name="Trash2" size="sm" />
      </button>
    </PhTooltip>
  </div>
</template>

<style scoped>
.message-hover-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--ph-space-1);
  padding: var(--ph-space-1);
  background-color: var(--ph-color-surface-raised);
  border: 1px solid var(--ph-color-border-subtle);
  border-radius: var(--ph-radius-md);
  box-shadow: var(--ph-shadow-sm);
}

.message-hover-actions__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--ph-radius-sm);
  color: var(--ph-color-text-muted);
  cursor: pointer;
}

.message-hover-actions__btn:hover {
  background-color: var(--ph-color-surface-hover);
  color: var(--ph-color-text-default);
}

.message-hover-actions__btn:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
}

.message-hover-actions__btn--danger:hover {
  color: var(--ph-color-danger);
}
</style>
