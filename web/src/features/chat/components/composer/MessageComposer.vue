<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { PhButton, PhIcon, PhTooltip, useToast } from '@phishyhub/design-system';
import ComposerInput from './ComposerInput.vue';
import AttachmentTray from './AttachmentTray.vue';
import TypingIndicator from './TypingIndicator.vue';
import type { PendingAttachment } from './AttachmentTray.vue';
import { useMessagesStore } from '../../../../stores/messages';
import { useDraftsStore } from '../../../../stores/drafts';
import { useDropZoneStore } from '../../../../stores/dropzone';
import { uploadFileWithProgress } from '../../../../api/endpoints/files';
import { emitTypingStart, emitTypingStop } from '../../../../socket/emit';
import { isApiError } from '../../../../api/errors';

/** Client-side pre-check only, referencing CONTRACT.md §7's `MAX_UPLOAD_SIZE_MB` default (25MB) — the server enforces the real limit. */
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
/** "at most once per 3s while actively typing" — task brief. */
const TYPING_THROTTLE_MS = 3_000;

const props = withDefaults(
  defineProps<{
    channelId: string;
    replyToMessageId?: string | null;
    /** Only the main channel composer should be true — AppShell's DropZone wraps `sidebar` + default (main), not the `aside` thread panel. */
    receiveGlobalDrops?: boolean;
    placeholder?: string;
  }>(),
  { replyToMessageId: null, receiveGlobalDrops: false, placeholder: undefined },
);

const messagesStore = useMessagesStore();
const draftsStore = useDraftsStore();
const dropZoneStore = useDropZoneStore();
const toast = useToast();

// Thread composers key their draft separately from the main composer so
// opening a thread in a channel doesn't clobber (or get clobbered by) the
// main composer's in-progress draft for the same channelId.
const draftKey = computed(() => (props.replyToMessageId ? `thread:${props.replyToMessageId}` : props.channelId));
const draft = ref(draftsStore.getDraft(draftKey.value));
const sending = ref(false);
const pendingAttachments = ref<PendingAttachment[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);

let lastTypingStartAt = 0;

watch(draftKey, (key) => {
  draft.value = draftsStore.getDraft(key);
});

watch(draft, (value) => {
  draftsStore.setDraft(draftKey.value, value);
});

function onTyping(): void {
  const now = Date.now();
  if (now - lastTypingStartAt < TYPING_THROTTLE_MS) return;
  lastTypingStartAt = now;
  emitTypingStart({ channelId: props.channelId });
}

function stopTyping(): void {
  if (lastTypingStartAt === 0) return;
  lastTypingStartAt = 0;
  emitTypingStop({ channelId: props.channelId });
}

function addFiles(files: File[]): void {
  for (const file of files) {
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.push({ title: 'File too large', description: `${file.name} is over the 25MB upload limit.`, variant: 'danger' });
      continue;
    }

    const id = crypto.randomUUID();
    pendingAttachments.value = [...pendingAttachments.value, { id, file, status: 'uploading', progress: 0 }];

    const { promise } = uploadFileWithProgress(file, (fraction) => {
      const target = pendingAttachments.value.find((a) => a.id === id);
      if (target) target.progress = fraction;
    });

    promise
      .then((fileDto) => {
        const target = pendingAttachments.value.find((a) => a.id === id);
        if (target) {
          target.status = 'done';
          target.progress = 1;
          target.fileId = fileDto.id;
        }
      })
      .catch((err) => {
        const target = pendingAttachments.value.find((a) => a.id === id);
        if (target) {
          target.status = 'error';
          target.errorMessage = isApiError(err) ? err.message : 'Upload failed';
        }
      });
  }
}

function onFileInputChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files?.length) addFiles(Array.from(input.files));
  input.value = '';
}

function removeAttachment(id: string): void {
  pendingAttachments.value = pendingAttachments.value.filter((a) => a.id !== id);
}

const isUploading = computed(() => pendingAttachments.value.some((a) => a.status === 'uploading'));
const canSend = computed(
  () =>
    !isUploading.value &&
    !sending.value &&
    (draft.value.trim().length > 0 || pendingAttachments.value.some((a) => a.status === 'done')),
);

async function onSubmit(): Promise<void> {
  if (!canSend.value) return;
  const body = draft.value.trim();
  const fileIds = pendingAttachments.value.filter((a) => a.status === 'done' && a.fileId).map((a) => a.fileId as string);

  sending.value = true;
  stopTyping();
  try {
    await messagesStore.sendMessage(props.channelId, {
      body: body || undefined,
      replyToMessageId: props.replyToMessageId ?? undefined,
      fileIds: fileIds.length ? fileIds : undefined,
    });
    draft.value = '';
    pendingAttachments.value = [];
    draftsStore.clearDraft(draftKey.value);
  } catch (err) {
    toast.push({
      title: 'Message failed to send',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    sending.value = false;
  }
}

watch(
  () => (props.receiveGlobalDrops ? dropZoneStore.version : -1),
  (version, previousVersion) => {
    if (props.receiveGlobalDrops && version !== previousVersion && dropZoneStore.files.length) {
      addFiles(dropZoneStore.files);
    }
  },
);

onBeforeUnmount(stopTyping);

defineExpose({ addFiles });
</script>

<template>
  <div class="message-composer">
    <TypingIndicator :channel-id="channelId" />
    <AttachmentTray :attachments="pendingAttachments" @remove="removeAttachment" />
    <div class="message-composer__row">
      <input ref="fileInputRef" type="file" multiple class="message-composer__file-input" @change="onFileInputChange" />
      <PhTooltip text="Attach file">
        <button type="button" class="message-composer__attach" aria-label="Attach file" @click="fileInputRef?.click()">
          <PhIcon name="Paperclip" size="sm" />
        </button>
      </PhTooltip>
      <ComposerInput
        v-model="draft"
        class="message-composer__input"
        :placeholder="placeholder ?? (replyToMessageId ? 'Reply…' : 'Message…')"
        :disabled="sending"
        @typing="onTyping"
        @submit="onSubmit"
        @blur="stopTyping"
      />
      <PhButton size="sm" :disabled="!canSend" :loading="sending" aria-label="Send message" @click="onSubmit">
        <PhIcon name="Send" size="sm" />
      </PhButton>
    </div>
  </div>
</template>

<style scoped>
.message-composer {
  border-top: 1px solid var(--ph-color-border-subtle);
  padding: var(--ph-space-2) 0 var(--ph-space-3);
  background-color: var(--ph-color-bg-canvas);
}

.message-composer__row {
  display: flex;
  align-items: flex-end;
  gap: var(--ph-space-2);
  padding: 0 var(--ph-space-4);
}

.message-composer__input {
  flex: 1 1 auto;
  min-width: 0;
}

.message-composer__file-input {
  display: none;
}

.message-composer__attach {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-muted);
}

.message-composer__attach:hover {
  background-color: var(--ph-color-surface-hover);
  color: var(--ph-color-text-default);
}

.message-composer__attach:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
}
</style>
