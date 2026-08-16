<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { PhButton, PhDropdown, PhIcon, PhScrollArea, PhSpinner } from '@phishyhub/design-system';
import { useChannelsStore } from '../../../../stores/channels';
import { useAuthStore } from '../../../../stores/auth';
import { useUiStore } from '../../../../stores/ui';
import { useUserProfile } from '../../../../composables/useUserProfile';
import ChannelSectionList from './ChannelSectionList.vue';
import ChannelCreateDialog from './ChannelCreateDialog.vue';
import ChannelBrowser from './ChannelBrowser.vue';
import DmComposerDialog from './DmComposerDialog.vue';
import UserAvatar from '../../../../components/shared/UserAvatar.vue';
import SearchPanel from '../shared/SearchPanel.vue';

const channelsStore = useChannelsStore();
const authStore = useAuthStore();
const uiStore = useUiStore();
const userProfile = useUserProfile();
const router = useRouter();

const createOpen = ref(false);
const browseOpen = ref(false);
const dmOpen = ref(false);
const searchOpen = ref(false);
const menuOpen = ref(false);

onMounted(() => {
  if (!channelsStore.loaded) void channelsStore.fetchChannels();
});

const channelSections = computed(() => channelsStore.channelList.filter((c) => c.type !== 'dm'));
const dmSections = computed(() => channelsStore.channelList.filter((c) => c.type === 'dm'));

function selectChannel(channelId: string): void {
  channelsStore.setActiveChannel(channelId);
  void router.push({ name: 'chat', params: { channelId } });
}

async function onLogout(): Promise<void> {
  await authStore.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <div class="channel-sidebar">
    <div class="channel-sidebar__header">
      <h2 class="channel-sidebar__title">Phishy Hub</h2>
      <div class="channel-sidebar__header-actions">
        <button type="button" class="channel-sidebar__icon-btn" aria-label="Search messages" @click="searchOpen = true">
          <PhIcon name="Search" size="sm" />
        </button>
        <PhDropdown v-model="menuOpen" align="end">
          <template #trigger>
            <span class="channel-sidebar__icon-btn" role="button" tabindex="0" aria-label="Create or join">
              <PhIcon name="Plus" size="sm" />
            </span>
          </template>
          <template #default="{ close }">
            <button
              type="button"
              role="menuitem"
              class="channel-sidebar__menu-item"
              @click="
                createOpen = true;
                close();
              "
            >
              <PhIcon name="Hash" size="sm" /> Create channel
            </button>
            <button
              type="button"
              role="menuitem"
              class="channel-sidebar__menu-item"
              @click="
                browseOpen = true;
                close();
              "
            >
              <PhIcon name="Users" size="sm" /> Browse channels
            </button>
            <button
              type="button"
              role="menuitem"
              class="channel-sidebar__menu-item"
              @click="
                dmOpen = true;
                close();
              "
            >
              <PhIcon name="MessageSquare" size="sm" /> New direct message
            </button>
          </template>
        </PhDropdown>
      </div>
    </div>

    <PhScrollArea class="channel-sidebar__list">
      <PhSpinner v-if="channelsStore.loading && channelsStore.channelList.length === 0" class="channel-sidebar__loading" />
      <template v-else-if="channelsStore.channelList.length === 0">
        <p class="channel-sidebar__empty">No channels yet — create or join one to get started.</p>
      </template>
      <template v-else>
        <ChannelSectionList
          title="Channels"
          :channels="channelSections"
          :active-channel-id="channelsStore.activeChannelId"
          @select="selectChannel"
        />
        <ChannelSectionList
          title="Direct messages"
          :channels="dmSections"
          :active-channel-id="channelsStore.activeChannelId"
          @select="selectChannel"
        />
      </template>
    </PhScrollArea>

    <div class="channel-sidebar__footer">
      <button
        v-if="authStore.user"
        type="button"
        class="channel-sidebar__self"
        aria-label="View your profile"
        @click="userProfile.open(authStore.user.id)"
      >
        <UserAvatar :user-id="authStore.user.id" size="sm" show-presence />
        <span class="channel-sidebar__user">{{ authStore.user.firstName }} {{ authStore.user.lastName }}</span>
      </button>
      <button type="button" class="channel-sidebar__icon-btn" aria-label="Toggle theme" @click="uiStore.toggleTheme">
        <PhIcon :name="uiStore.theme === 'dark' ? 'Sun' : 'Moon'" size="sm" />
      </button>
      <PhButton variant="ghost" size="sm" @click="onLogout">Log out</PhButton>
    </div>

    <ChannelCreateDialog v-model="createOpen" @created="selectChannel" />
    <ChannelBrowser v-model="browseOpen" @joined="selectChannel" />
    <DmComposerDialog v-model="dmOpen" @created="selectChannel" />
    <SearchPanel v-model="searchOpen" />
  </div>
</template>

<style scoped>
.channel-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.channel-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ph-space-4) var(--ph-space-4) var(--ph-space-2);
}

.channel-sidebar__title {
  margin: 0;
  font-size: var(--ph-font-size-md);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.channel-sidebar__header-actions {
  display: flex;
  align-items: center;
  gap: var(--ph-space-1);
}

.channel-sidebar__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-muted);
  cursor: pointer;
}

.channel-sidebar__icon-btn:hover {
  background-color: var(--ph-color-surface-hover);
  color: var(--ph-color-text-default);
}

.channel-sidebar__icon-btn:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
}

.channel-sidebar__menu-item {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  width: 100%;
  padding: var(--ph-space-2);
  border-radius: var(--ph-radius-sm);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
  white-space: nowrap;
}

.channel-sidebar__menu-item:hover {
  background-color: var(--ph-color-surface-hover);
}

.channel-sidebar__list {
  flex: 1 1 auto;
  padding: 0 var(--ph-space-2) var(--ph-space-2);
}

.channel-sidebar__loading {
  display: flex;
  justify-content: center;
  margin-top: var(--ph-space-4);
}

.channel-sidebar__empty {
  padding: var(--ph-space-3);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-subtle);
}

.channel-sidebar__footer {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-3) var(--ph-space-4);
  border-top: 1px solid var(--ph-color-border-subtle);
}

.channel-sidebar__self {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  flex: 1;
  min-width: 0;
  padding: var(--ph-space-1);
  border-radius: var(--ph-radius-md);
}

.channel-sidebar__self:hover {
  background-color: var(--ph-color-surface-hover);
}

.channel-sidebar__self:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
}

.channel-sidebar__user {
  flex: 1;
  min-width: 0;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
</style>
