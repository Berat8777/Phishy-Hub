<script setup lang="ts">
import ImagePreview from './ImagePreview.vue';
import FileCard from './FileCard.vue';
import type { MessageAttachmentDTO } from '../../../../api/types';

defineProps<{ attachments: MessageAttachmentDTO[] }>();

function isImage(attachment: MessageAttachmentDTO): boolean {
  return attachment.mimeType.startsWith('image/');
}
</script>

<template>
  <div v-if="attachments.length" class="message-attachments">
    <template v-for="attachment in attachments" :key="attachment.fileId">
      <ImagePreview v-if="isImage(attachment)" :attachment="attachment" />
      <FileCard v-else :attachment="attachment" />
    </template>
  </div>
</template>

<style scoped>
.message-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ph-space-2);
  margin-top: var(--ph-space-1);
}
</style>
