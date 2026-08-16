<script setup lang="ts">
/**
 * Cheaply-derived counters only — no dedicated backend stats endpoint (the
 * architect explicitly ruled that out this phase). Every number here comes
 * from `meta.total` on an existing offset-paginated list call with
 * `pageSize: 1`, so the payload cost is minimal regardless of how many
 * rows actually match.
 */
import { onMounted, ref } from 'vue';
import * as usersApi from '../../../api/endpoints/users';
import * as departmentsApi from '../../../api/endpoints/departments';
import StatCard from '../components/StatCard.vue';
import { ALL_USER_ROLES, USER_ROLE_LABELS } from '../lib/roles';
import type { UserRole } from '../../../api/types';

const loading = ref(true);
const totalUsers = ref(0);
const totalDepartments = ref(0);
const byRole = ref<Partial<Record<UserRole, number>>>({});

onMounted(async () => {
  loading.value = true;
  try {
    const [usersRes, departmentsRes, ...roleResults] = await Promise.all([
      usersApi.listUsers({ pageSize: 1 }),
      departmentsApi.listDepartments({ pageSize: 1 }),
      ...ALL_USER_ROLES.map((role) => usersApi.listUsers({ role, pageSize: 1 })),
    ]);
    totalUsers.value = usersRes.meta.total;
    totalDepartments.value = departmentsRes.meta.total;
    const counts: Partial<Record<UserRole, number>> = {};
    ALL_USER_ROLES.forEach((role, index) => {
      counts[role] = roleResults[index].meta.total;
    });
    byRole.value = counts;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="admin-overview-view">
    <h1 class="admin-overview-view__title">Overview</h1>

    <div class="admin-overview-view__grid">
      <StatCard label="Total users" :value="totalUsers" :loading="loading" />
      <StatCard label="Total departments" :value="totalDepartments" :loading="loading" />
      <StatCard
        v-for="role in ALL_USER_ROLES"
        :key="role"
        :label="USER_ROLE_LABELS[role]"
        :value="byRole[role]"
        :loading="loading"
      />
    </div>
  </div>
</template>

<style scoped>
.admin-overview-view {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-4);
  padding: var(--ph-space-5);
  overflow-y: auto;
}

.admin-overview-view__title {
  margin: 0;
  font-size: var(--ph-font-size-lg);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.admin-overview-view__grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ph-space-3);
}
</style>
