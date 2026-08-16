<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { PhBadge, PhButton, PhEmptyState, PhIcon, PhInput, PhModal, PhSpinner, PhTabs, PhTooltip, useToast } from '@phishyhub/design-system';
import type { TabItem } from '@phishyhub/design-system';
import * as usersApi from '../../../../api/endpoints/users';
import * as channelsApi from '../../../../api/endpoints/channels';
import { useChannelsStore } from '../../../../stores/channels';
import { useUsersStore } from '../../../../stores/users';
import { useAuthStore } from '../../../../stores/auth';
import { canAddChannelMember } from '../../../../lib/permissions';
import { isApiError } from '../../../../api/errors';
import UserAvatar from '../../../../components/shared/UserAvatar.vue';
import UserPopover from './UserPopover.vue';
import ImagePreview from '../message-list/ImagePreview.vue';
import type { ChannelAttachmentDTO, UserDTO } from '../../../../api/types';

/**
 * Channel-info panel — Members (the original content of this component,
 * pre-restructure), Media, and Files, mirroring WhatsApp/Discord's
 * channel-info panel. Triggered the same way as before: ChatView.vue's
 * "Members"/people-icon header button.
 */
const props = defineProps<{ modelValue: boolean; channelId: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const channelsStore = useChannelsStore();
const usersStore = useUsersStore();
const authStore = useAuthStore();
const toast = useToast();

const TABS: TabItem[] = [
  { id: 'members', label: 'Members' },
  { id: 'media', label: 'Media' },
  { id: 'files', label: 'Files' },
];
const activeTab = ref('members');

const loading = ref(false);
const query = ref('');
const searchResults = ref<UserDTO[]>([]);
const searching = ref(false);
const addingUserId = ref<string | null>(null);
const removingUserId = ref<string | null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const members = computed(() => channelsStore.getMembers(props.channelId) ?? []);

/** The viewer's own membership row in THIS channel, if any — `canAddChannelMember` needs it (channel-admin-ness lives on the membership, not on UserDTO). Removal uses the identical server-side rule (`assertChannelAdmin`, channel.service.ts::removeMember), so this same predicate gates both actions. */
const ownMembership = computed(
  () => members.value.find((m) => m.userId === authStore.user?.id) ?? null,
);
const canManageMembers = computed(() => canAddChannelMember(authStore.user, ownMembership.value));

async function ensureMembersAndUsers(): Promise<void> {
  loading.value = true;
  try {
    const list = await channelsStore.fetchMembers(props.channelId);
    await Promise.all(
      list.map((m) => (usersStore.getUser(m.userId) ? Promise.resolve() : usersStore.fetchUser(m.userId).catch(() => undefined))),
    );
  } finally {
    loading.value = false;
  }
}

interface AttachmentTabState {
  items: ChannelAttachmentDTO[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  loaded: boolean;
}

function freshAttachmentState(): AttachmentTabState {
  return { items: [], page: 0, hasMore: false, loading: false, loadingMore: false, loaded: false };
}

const mediaState = ref<AttachmentTabState>(freshAttachmentState());
const filesState = ref<AttachmentTabState>(freshAttachmentState());

function stateFor(type: 'image' | 'file'): typeof mediaState {
  return type === 'image' ? mediaState : filesState;
}

async function loadAttachments(type: 'image' | 'file', more = false): Promise<void> {
  const state = stateFor(type);
  if (more) state.value.loadingMore = true;
  else state.value.loading = true;
  try {
    const page = more ? state.value.page + 1 : 1;
    const { items, meta } = await channelsApi.listAttachments(props.channelId, { type, page, pageSize: 20 });
    state.value.items = more ? [...state.value.items, ...items] : items;
    state.value.page = meta.page;
    state.value.hasMore = meta.page < meta.totalPages;
    state.value.loaded = true;
  } catch (err) {
    toast.push({
      title: type === 'image' ? 'Could not load media' : 'Could not load files',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    state.value.loading = false;
    state.value.loadingMore = false;
  }
}

watch(activeTab, (tab) => {
  if (tab === 'media' && !mediaState.value.loaded) void loadAttachments('image');
  if (tab === 'files' && !filesState.value.loaded) void loadAttachments('file');
});

watch(
  () => [props.modelValue, props.channelId] as const,
  ([open]) => {
    if (open) {
      activeTab.value = 'members';
      query.value = '';
      searchResults.value = [];
      mediaState.value = freshAttachmentState();
      filesState.value = freshAttachmentState();
      void ensureMembersAndUsers();
    }
  },
);

watch(query, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!q) {
    searchResults.value = [];
    return;
  }
  searching.value = true;
  debounceTimer = setTimeout(async () => {
    try {
      const { items } = await usersApi.listUsers({ q, pageSize: 8 });
      searchResults.value = items.filter((u) => !members.value.some((m) => m.userId === u.id));
    } catch {
      searchResults.value = [];
    } finally {
      searching.value = false;
    }
  }, 200);
});

function displayName(userId: string): string {
  const user = usersStore.getUser(userId);
  return user ? `${user.firstName} ${user.lastName}` : 'Unknown user';
}

function orgRole(userId: string): string {
  const user = usersStore.getUser(userId);
  return user ? user.role : '';
}

async function addMember(user: UserDTO): Promise<void> {
  addingUserId.value = user.id;
  try {
    await channelsStore.addMember(props.channelId, user.id);
    usersStore.upsert(user);
    searchResults.value = searchResults.value.filter((u) => u.id !== user.id);
  } catch (err) {
    toast.push({
      title: 'Could not add member',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    addingUserId.value = null;
  }
}

/**
 * `DELETE /channels/:id/members/:userId` — gated by `canManageMembers`
 * (same server rule as add). The viewer's own row never renders this
 * control (see template) — self-removal from a channel goes through
 * "leave channel" (`POST /channels/:id/leave`), not this admin-only
 * removal action; there is no "leave channel" UI affordance wired up
 * anywhere yet (a pre-existing gap, out of scope here).
 */
async function removeMember(userId: string): Promise<void> {
  removingUserId.value = userId;
  try {
    await channelsStore.removeMember(props.channelId, userId);
  } catch (err) {
    toast.push({
      title: 'Could not remove member',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    removingUserId.value = null;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
</script>

<template>
  <PhModal
    :model-value="modelValue"
    title="Channel info"
    size="sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="channel-info-panel">
      <PhTabs v-model="activeTab" :tabs="TABS">
        <template #members>
          <div class="channel-info-panel__tab">
            <PhSpinner v-if="loading" size="md" />

            <ul v-else class="channel-info-panel__list">
              <li v-for="member in members" :key="member.id" class="channel-info-panel__item">
                <UserPopover :user-id="member.userId" class="channel-info-panel__trigger">
                  <div class="channel-info-panel__row">
                    <UserAvatar :user-id="member.userId" size="sm" />
                    <div class="channel-info-panel__info">
                      <span class="channel-info-panel__name">{{ displayName(member.userId) }}</span>
                      <span class="channel-info-panel__org-role">{{ orgRole(member.userId) }}</span>
                    </div>
                    <PhBadge :variant="member.channelRole === 'admin' ? 'accent' : 'default'">
                      {{ member.channelRole }}
                    </PhBadge>
                  </div>
                </UserPopover>
                <PhTooltip v-if="canManageMembers && member.userId !== authStore.user?.id" text="Remove from channel">
                  <button
                    type="button"
                    class="channel-info-panel__remove"
                    :aria-label="`Remove ${displayName(member.userId)} from channel`"
                    :disabled="removingUserId === member.userId"
                    @click="removeMember(member.userId)"
                  >
                    <PhSpinner v-if="removingUserId === member.userId" size="sm" />
                    <PhIcon v-else name="X" size="sm" />
                  </button>
                </PhTooltip>
              </li>
            </ul>

            <div v-if="canManageMembers" class="channel-info-panel__add">
              <PhInput v-model="query" placeholder="Add a person by name or email…" />
              <PhSpinner v-if="searching" size="sm" />
              <ul v-else-if="searchResults.length" class="channel-info-panel__results">
                <li
                  v-for="user in searchResults"
                  :key="user.id"
                  class="channel-info-panel__result"
                  @click="addMember(user)"
                >
                  <UserAvatar :user-id="user.id" size="sm" />
                  <span>{{ user.firstName }} {{ user.lastName }}</span>
                  <PhSpinner v-if="addingUserId === user.id" size="sm" />
                  <PhIcon v-else name="Plus" size="sm" class="channel-info-panel__result-icon" />
                </li>
              </ul>
            </div>
          </div>
        </template>

        <template #media>
          <div class="channel-info-panel__tab">
            <PhSpinner v-if="mediaState.loading" size="md" />
            <PhEmptyState
              v-else-if="mediaState.items.length === 0"
              title="No media yet"
              description="Images shared in this channel will show up here."
            >
              <template #icon><PhIcon name="Image" size="xl" /></template>
            </PhEmptyState>
            <template v-else>
              <div class="channel-info-panel__media-grid">
                <ImagePreview
                  v-for="item in mediaState.items"
                  :key="item.fileId"
                  :attachment="item"
                  :thumb-width="88"
                  :thumb-height="88"
                />
              </div>
              <PhButton
                v-if="mediaState.hasMore"
                variant="ghost"
                size="sm"
                :loading="mediaState.loadingMore"
                @click="loadAttachments('image', true)"
              >
                Load more
              </PhButton>
            </template>
          </div>
        </template>

        <template #files>
          <div class="channel-info-panel__tab">
            <PhSpinner v-if="filesState.loading" size="md" />
            <PhEmptyState
              v-else-if="filesState.items.length === 0"
              title="No files yet"
              description="Files shared in this channel will show up here."
            >
              <template #icon><PhIcon name="File" size="xl" /></template>
            </PhEmptyState>
            <template v-else>
              <ul class="channel-info-panel__file-list">
                <li v-for="item in filesState.items" :key="item.fileId" class="channel-info-panel__file-row">
                  <span class="channel-info-panel__file-icon"><PhIcon name="File" size="md" /></span>
                  <div class="channel-info-panel__file-body">
                    <span class="channel-info-panel__file-name">{{ item.originalName }}</span>
                    <span class="channel-info-panel__file-meta">
                      {{ formatSize(item.sizeBytes) }}
                      <template v-if="item.uploadedBy"> · {{ item.uploadedBy.firstName }} {{ item.uploadedBy.lastName }}</template>
                      · {{ formatDate(item.createdAt) }}
                    </span>
                  </div>
                </li>
              </ul>
              <PhButton
                v-if="filesState.hasMore"
                variant="ghost"
                size="sm"
                :loading="filesState.loadingMore"
                @click="loadAttachments('file', true)"
              >
                Load more
              </PhButton>
            </template>
          </div>
        </template>
      </PhTabs>
    </div>
  </PhModal>
</template>

<style scoped>
.channel-info-panel {
  display: flex;
  flex-direction: column;
}

.channel-info-panel__tab {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--ph-space-3);
  min-height: 120px;
}

.channel-info-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
}

.channel-info-panel__item {
  display: flex;
  align-items: center;
  gap: var(--ph-space-1);
}

.channel-info-panel__trigger {
  flex: 1;
  min-width: 0;
}

.channel-info-panel__trigger :deep(.user-popover__trigger) {
  width: 100%;
  border-radius: var(--ph-radius-md);
}

.channel-info-panel__row {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  width: 100%;
  padding: var(--ph-space-2);
  border-radius: var(--ph-radius-md);
}

.channel-info-panel__row:hover {
  background-color: var(--ph-color-surface-hover);
}

.channel-info-panel__info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  text-align: left;
}

.channel-info-panel__name {
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-medium);
  color: var(--ph-color-text-default);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-info-panel__org-role {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
  text-transform: capitalize;
}

.channel-info-panel__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: var(--ph-radius-full);
  color: var(--ph-color-text-subtle);
  transition:
    background-color var(--ph-duration-fast) var(--ph-easing-standard),
    color var(--ph-duration-fast) var(--ph-easing-standard);
}

.channel-info-panel__remove:hover:not(:disabled) {
  background-color: var(--ph-color-danger-subtle);
  color: var(--ph-color-danger);
}

.channel-info-panel__remove:disabled {
  cursor: default;
  opacity: 0.6;
}

.channel-info-panel__add {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-2);
  padding-top: var(--ph-space-3);
  border-top: 1px solid var(--ph-color-border-subtle);
}

.channel-info-panel__results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
}

.channel-info-panel__result {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-2);
  border-radius: var(--ph-radius-md);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-default);
  cursor: pointer;
}

.channel-info-panel__result:hover {
  background-color: var(--ph-color-surface-hover);
}

.channel-info-panel__result span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-info-panel__result-icon {
  color: var(--ph-color-text-muted);
}

.channel-info-panel__media-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ph-space-2);
  max-height: 360px;
  overflow-y: auto;
}

.channel-info-panel__file-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 360px;
  overflow-y: auto;
}

.channel-info-panel__file-row {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-2);
  border-radius: var(--ph-radius-md);
}

.channel-info-panel__file-row:hover {
  background-color: var(--ph-color-surface-hover);
}

.channel-info-panel__file-icon {
  display: inline-flex;
  color: var(--ph-color-text-muted);
}

.channel-info-panel__file-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.channel-info-panel__file-name {
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-medium);
  color: var(--ph-color-text-default);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-info-panel__file-meta {
  font-size: var(--ph-font-size-xs);
  color: var(--ph-color-text-subtle);
}
</style>
