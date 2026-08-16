<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PhEmptyState, PhIcon, PhTooltip } from '@phishyhub/design-system';
import { useChannelsStore } from '../../../stores/channels';
import { useSearchStore } from '../../../stores/search';
import { useChannelLabel } from '../composables/useChannelLabel';
import MessageList from '../components/message-list/MessageList.vue';
import MessageComposer from '../components/composer/MessageComposer.vue';
import ChannelMembersPanel from '../components/shared/ChannelMembersPanel.vue';
import UserAvatar from '../../../components/shared/UserAvatar.vue';
import PresenceDot from '../../../components/shared/PresenceDot.vue';

const route = useRoute();
const router = useRouter();
const channelsStore = useChannelsStore();
const searchStore = useSearchStore();

const channelId = computed(() => (typeof route.params.channelId === 'string' ? route.params.channelId : null));

watch(
  channelId,
  (id) => {
    channelsStore.setActiveChannel(id);
  },
  { immediate: true },
);

const activeChannel = computed(() => channelsStore.activeChannel);
const { label, otherMemberIds } = useChannelLabel(() => activeChannel.value);
const singleOtherUserId = computed(() => (otherMemberIds.value.length === 1 ? otherMemberIds.value[0] : null));

const messageListRef = ref<InstanceType<typeof MessageList> | null>(null);
const membersPanelOpen = ref(false);

function onReply(messageId: string): void {
  if (!activeChannel.value) return;
  void router.push({ name: 'chat-thread', params: { channelId: activeChannel.value.id, messageId } });
}

// SearchPanel.vue navigates here then hands the target message off via the
// search store (it has no direct reference to MessageList to call
// scrollToMessage on itself).
watch(
  () => searchStore.scrollTarget,
  async (target) => {
    if (!target || target.channelId !== channelId.value) return;
    const consumed = searchStore.consumeScrollTarget();
    if (!consumed) return;
    await nextTick();
    await messageListRef.value?.scrollToMessage(consumed.messageId);
  },
);
</script>

<template>
  <div class="chat-view">
    <template v-if="activeChannel">
      <header class="chat-view__header">
        <span v-if="activeChannel.type === 'dm' && singleOtherUserId" class="chat-view__header-avatar">
          <UserAvatar :user-id="singleOtherUserId" size="sm" />
          <PresenceDot :user-id="singleOtherUserId" />
        </span>
        <PhIcon v-else-if="activeChannel.type !== 'dm'" name="Hash" size="sm" />
        <h1 class="chat-view__title">{{ label }}</h1>

        <PhTooltip v-if="activeChannel.type !== 'dm'" text="Members">
          <button
            type="button"
            class="chat-view__members-btn"
            aria-label="View channel members"
            @click="membersPanelOpen = true"
          >
            <PhIcon name="Users" size="sm" />
          </button>
        </PhTooltip>
      </header>

      <MessageList ref="messageListRef" :source="{ kind: 'channel', id: activeChannel.id }" @reply="onReply" />
      <MessageComposer :channel-id="activeChannel.id" receive-global-drops />

      <ChannelMembersPanel v-if="activeChannel.type !== 'dm'" v-model="membersPanelOpen" :channel-id="activeChannel.id" />
    </template>

    <div v-else class="chat-view__body">
      <PhEmptyState title="Select a channel" description="Pick a channel from the sidebar to get started.">
        <template #icon>
          <PhIcon name="MessageSquare" size="xl" />
        </template>
      </PhEmptyState>
    </div>
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-view__header {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-4);
  border-bottom: 1px solid var(--ph-color-border-subtle);
  color: var(--ph-color-text-muted);
}

.chat-view__header-avatar {
  position: relative;
  display: inline-flex;
}

.chat-view__header-avatar :deep(.presence-dot) {
  position: absolute;
  right: -2px;
  bottom: -2px;
}

.chat-view__title {
  margin: 0;
  font-size: var(--ph-font-size-lg);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.chat-view__members-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-left: auto;
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-muted);
}

.chat-view__members-btn:hover {
  background-color: var(--ph-color-surface-hover);
  color: var(--ph-color-text-default);
}

.chat-view__members-btn:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
}

.chat-view__body {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
}
</style>
