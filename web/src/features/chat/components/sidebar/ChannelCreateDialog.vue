<script setup lang="ts">
import { ref, watch } from 'vue';
import { PhButton, PhInput, PhModal, useToast } from '@phishyhub/design-system';
import * as channelsApi from '../../../../api/endpoints/channels';
import { useChannelsStore } from '../../../../stores/channels';
import { isApiError } from '../../../../api/errors';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [channelId: string] }>();

const channelsStore = useChannelsStore();
const toast = useToast();

const name = ref('');
const type = ref<'public' | 'private'>('public');
const creating = ref(false);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      name.value = '';
      type.value = 'public';
    }
  },
);

async function onCreate(): Promise<void> {
  const trimmed = name.value.trim();
  if (!trimmed) return;
  creating.value = true;
  try {
    const channel = await channelsApi.createChannel({ type: type.value, name: trimmed });
    channelsStore.upsertChannel({ ...channel, unreadCount: 0, lastReadMessageId: null, lastMessage: null });
    emit('created', channel.id);
    emit('update:modelValue', false);
    toast.push({ title: 'Channel created', variant: 'success' });
  } catch (err) {
    toast.push({
      title: 'Could not create channel',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <PhModal :model-value="modelValue" title="Create a channel" size="sm" @update:model-value="emit('update:modelValue', $event)">
    <div class="channel-create-dialog">
      <label class="channel-create-dialog__field">
        <span>Name</span>
        <PhInput v-model="name" placeholder="e.g. product-launch" @keydown.enter="onCreate" />
      </label>

      <div class="channel-create-dialog__toggle" role="radiogroup" aria-label="Visibility">
        <button
          type="button"
          class="channel-create-dialog__toggle-btn"
          :class="{ 'channel-create-dialog__toggle-btn--active': type === 'public' }"
          role="radio"
          :aria-checked="type === 'public'"
          @click="type = 'public'"
        >
          Public
        </button>
        <button
          type="button"
          class="channel-create-dialog__toggle-btn"
          :class="{ 'channel-create-dialog__toggle-btn--active': type === 'private' }"
          role="radio"
          :aria-checked="type === 'private'"
          @click="type = 'private'"
        >
          Private
        </button>
      </div>
    </div>

    <template #footer>
      <PhButton variant="ghost" @click="emit('update:modelValue', false)">Cancel</PhButton>
      <PhButton :loading="creating" :disabled="!name.trim()" @click="onCreate">Create</PhButton>
    </template>
  </PhModal>
</template>

<style scoped>
.channel-create-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
}

.channel-create-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}

.channel-create-dialog__toggle {
  display: inline-flex;
  border: 1px solid var(--ph-color-border-strong);
  border-radius: var(--ph-radius-md);
  overflow: hidden;
  width: fit-content;
}

.channel-create-dialog__toggle-btn {
  padding: var(--ph-space-2) var(--ph-space-4);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}

.channel-create-dialog__toggle-btn--active {
  background-color: var(--ph-color-accent);
  color: var(--ph-color-text-on-accent);
}
</style>
