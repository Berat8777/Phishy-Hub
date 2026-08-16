<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { PhIcon } from '@phishyhub/design-system';
import { useAuthStore } from '../../../stores/auth';

const route = useRoute();
const authStore = useAuthStore();

/** Same access rule the view itself enforces (see LeaveApprovalsView.vue) — hidden here too so it's not a dead-end link. */
const canSeeApprovals = computed(() => {
  const user = authStore.user;
  if (!user) return false;
  if (user.role === 'hr' || user.role === 'admin') return true;
  return (user.managedDepartmentIds ?? []).length > 0;
});

const links = computed(() => [
  { name: 'hr', label: 'My requests', icon: 'FileText' as const, show: true },
  { name: 'hr-approvals', label: 'Approvals', icon: 'CheckSquare' as const, show: canSeeApprovals.value },
  { name: 'hr-calendar', label: 'Team calendar', icon: 'CalendarDays' as const, show: true },
]);
</script>

<template>
  <div class="hr-sidebar">
    <div class="hr-sidebar__header">
      <h2 class="hr-sidebar__title">Leave &amp; HR</h2>
    </div>
    <nav class="hr-sidebar__nav">
      <router-link
        v-for="link in links.filter((l) => l.show)"
        :key="link.name"
        :to="{ name: link.name }"
        class="hr-sidebar__link"
        :class="{ 'hr-sidebar__link--active': route.name === link.name }"
      >
        <PhIcon :name="link.icon" size="sm" />
        <span>{{ link.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.hr-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.hr-sidebar__header {
  padding: var(--ph-space-4) var(--ph-space-4) var(--ph-space-2);
}

.hr-sidebar__title {
  margin: 0;
  font-size: var(--ph-font-size-md);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.hr-sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-1);
  padding: var(--ph-space-2);
}

.hr-sidebar__link {
  display: flex;
  align-items: center;
  gap: var(--ph-space-2);
  padding: var(--ph-space-2) var(--ph-space-3);
  border-radius: var(--ph-radius-md);
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}

.hr-sidebar__link:hover {
  background-color: var(--ph-color-surface-hover);
  color: var(--ph-color-text-default);
}

.hr-sidebar__link--active {
  background-color: var(--ph-color-accent-subtle);
  color: var(--ph-color-accent-subtle-text);
}
</style>
