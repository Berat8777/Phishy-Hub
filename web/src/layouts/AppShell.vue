<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { PhIcon } from '@phishyhub/design-system';
import type { IconName } from '@phishyhub/design-system';
import DropZone from '../features/chat/components/composer/DropZone.vue';
import { useDropZoneStore } from '../stores/dropzone';
import { useAuthStore } from '../stores/auth';
import { canManageDepartments, canManageUsers, canUseAi } from '../lib/permissions';

/**
 * Left icon rail. Modeled as a list so a later phase can append more
 * entries without restructuring this component — each entry just needs a
 * `section` matching some route's `meta.section` (router/index.ts) and a
 * route name to navigate to.
 *
 * Active-state uses `meta.section` (NOT exact route-name matching) so a
 * nested route like `chat-thread` still highlights "Chat" — the previous
 * exact-match check only ever matched the bare `chat`/`boards` route name,
 * missing every child route under it.
 */
interface RailItem {
  key: string;
  label: string;
  icon: IconName;
  section: string;
  routeName: string;
}

const router = useRouter();
const authStore = useAuthStore();
const activeSection = computed(() => router.currentRoute.value.meta.section);
const dropZoneStore = useDropZoneStore();

/**
 * `admin` is hidden entirely (not just disabled) for anyone who'd just get
 * redirected out of it by `roleGuard` (`meta.roles: ['admin','hr']`) — an
 * employee/developer/sales user has no reachable page under `/admin`, so
 * showing the icon at all would be a confusing dead end.
 */
const railItems = computed<RailItem[]>(() => {
  const items: RailItem[] = [
    { key: 'chat', label: 'Chat', icon: 'MessageSquare', section: 'chat', routeName: 'chat' },
    { key: 'boards', label: 'Boards', icon: 'Kanban', section: 'boards', routeName: 'boards' },
    { key: 'hr', label: 'Leave', icon: 'CalendarDays', section: 'hr', routeName: 'hr' },
  ];
  // Hidden entirely (not just disabled) for anyone `roleGuard` (`meta.roles`
  // on `/ai`) would just bounce back out — same precedent as `admin` below.
  if (canUseAi(authStore.user)) {
    items.push({ key: 'ai', label: 'AI Assistant', icon: 'Sparkles', section: 'ai', routeName: 'ai' });
  }
  if (canManageUsers(authStore.user) || canManageDepartments(authStore.user)) {
    items.push({ key: 'admin', label: 'Admin', icon: 'ShieldCheck', section: 'admin', routeName: 'admin' });
  }
  return items;
});

function go(routeName: string): void {
  void router.push({ name: routeName });
}
</script>

<template>
  <div class="app-shell">
    <nav class="app-shell__rail" aria-label="Primary">
      <span class="app-shell__mark" aria-hidden="true">P</span>
      <button
        v-for="item in railItems"
        :key="item.key"
        type="button"
        class="app-shell__rail-item"
        :class="{ 'app-shell__rail-item--active': activeSection === item.section }"
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
  position: relative;
  z-index: 1;
  flex: 0 0 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-3) 0;
  background-color: var(--ph-color-surface-raised);
  border-right: 1px solid var(--ph-color-border-subtle);
  box-shadow: var(--ph-shadow-sm);
}

.app-shell__mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-bottom: var(--ph-space-3);
  border-radius: var(--ph-radius-md);
  background: linear-gradient(135deg, var(--ph-palette-blue-500), var(--ph-palette-orange-500));
  color: var(--ph-color-text-inverse);
  font-family: var(--ph-font-family-base);
  font-weight: var(--ph-font-weight-bold);
  font-size: var(--ph-font-size-md);
  box-shadow: 0 6px 16px -6px rgb(37 99 235 / 0.55);
}

.app-shell__rail-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-muted);
  transition:
    background-color var(--ph-duration-fast) var(--ph-easing-standard),
    color var(--ph-duration-fast) var(--ph-easing-standard);
}

.app-shell__rail-item:hover {
  background-color: var(--ph-color-surface-hover);
  color: var(--ph-color-text-default);
}

.app-shell__rail-item--active {
  background: linear-gradient(135deg, var(--ph-color-accent-subtle), var(--ph-color-accent-subtle) 60%);
  color: var(--ph-color-accent);
}

.app-shell__rail-item--active::before {
  content: '';
  position: absolute;
  left: -13px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  border-radius: var(--ph-radius-full);
  background: linear-gradient(var(--ph-palette-blue-500), var(--ph-palette-orange-500));
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
