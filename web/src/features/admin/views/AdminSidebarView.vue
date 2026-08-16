<script setup lang="ts">
import { useRoute } from 'vue-router';
import { PhIcon } from '@phishyhub/design-system';

const route = useRoute();

const links = [
  { name: 'admin', label: 'Overview', icon: 'LayoutDashboard' as const },
  { name: 'admin-users', label: 'Users', icon: 'Users' as const },
  { name: 'admin-departments', label: 'Departments', icon: 'Building2' as const },
];
</script>

<template>
  <div class="admin-sidebar">
    <div class="admin-sidebar__header">
      <h2 class="admin-sidebar__title">Admin</h2>
    </div>
    <nav class="admin-sidebar__nav">
      <router-link
        v-for="link in links"
        :key="link.name"
        :to="{ name: link.name }"
        class="admin-sidebar__link"
        :class="{ 'admin-sidebar__link--active': route.name === link.name }"
      >
        <PhIcon :name="link.icon" size="sm" />
        <span>{{ link.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.admin-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.admin-sidebar__header {
  padding: var(--ph-space-4) var(--ph-space-4) var(--ph-space-2);
}

.admin-sidebar__title {
  margin: 0;
  font-size: var(--ph-font-size-md);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.admin-sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  padding: var(--ph-space-2);
}

.admin-sidebar__link {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-2) var(--ph-space-3);
  border-radius: var(--ph-radius-md);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}

.admin-sidebar__link:hover {
  background-color: var(--ph-color-surface-hover);
  color: var(--ph-color-text-default);
}

.admin-sidebar__link--active {
  background-color: var(--ph-color-accent-subtle);
  color: var(--ph-color-accent-subtle-text);
}
</style>
