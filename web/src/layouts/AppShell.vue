<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { PhIcon } from '@phishyhub/design-system';
import type { IconName } from '@phishyhub/design-system';
import DropZone from '../features/chat/components/composer/DropZone.vue';
import { useDropZoneStore } from '../stores/dropzone';

/**
 * Left icon rail — just a "Chat" entry for now. Modeled as a list so a
 * later phase can append more entries (tickets, leave requests, meetings)
 * without restructuring this component.
 */
interface RailItem {
  key: string;
  label: string;
  icon: IconName;
  routeName: string;
}

const railItems: RailItem[] = [{ key: 'chat', label: 'Chat', icon: 'MessageSquare', routeName: 'chat' }];

const router = useRouter();
const activeRouteName = computed(() => router.currentRoute.value.name);
const dropZoneStore = useDropZoneStore();

function go(routeName: string): void {
  void router.push({ name: routeName });
}
</script>

<template>
  <div class="app-shell">
    <nav class="app-shell__rail" aria-label="Primary">
      <button
        v-for="item in railItems"
        :key="item.key"
        type="button"
        class="app-shell__rail-item"
        :class="{ 'app-shell__rail-item--active': activeRouteName === item.routeName }"
        :aria-label="item.label"
        @click="go(item.routeName)"
      >
        <PhIcon :name="item.icon" />
      </button>
    </nav>

    <!--
      Wraps BOTH named views (not just the composer) — task brief: "drag-and-
      drop anywhere in the chat area should work". Dropped files are handed
      to whichever MessageComposer opted in via `stores/dropzone.ts`, since
      this layout has no direct reference to it (separate named router-view
      trees).
    -->
    <DropZone @drop-files="dropZoneStore.pushFiles">
      <div class="app-shell__sidebar">
        <router-view name="sidebar" />
      </div>

      <div class="app-shell__main">
        <router-view />
      </div>
    </DropZone>

    <div class="app-shell__aside">
      <router-view name="aside" />
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background-color: var(--ph-color-bg-canvas);
}

.app-shell__rail {
  flex: 0 0 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-3) 0;
  background-color: var(--ph-color-surface-raised);
  border-right: 1px solid var(--ph-color-border-subtle);
}

.app-shell__rail-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-muted);
}

.app-shell__rail-item:hover {
  background-color: var(--ph-color-surface-hover);
  color: var(--ph-color-text-default);
}

.app-shell__rail-item--active {
  background-color: var(--ph-color-accent-subtle);
  color: var(--ph-color-accent-subtle-text);
}

.app-shell__rail-item:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
}

.app-shell__sidebar {
  flex: 0 0 280px;
  overflow-y: auto;
  border-right: 1px solid var(--ph-color-border-subtle);
  background-color: var(--ph-color-surface-raised);
}

.app-shell__main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-shell__aside {
  flex: 0 0 auto;
}
</style>
