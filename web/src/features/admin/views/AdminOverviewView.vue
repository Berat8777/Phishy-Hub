<script setup lang="ts">
/**
 * Cheaply-derived counters only — no dedicated backend stats endpoint (the
 * architect explicitly ruled that out this phase). Every number here comes
 * from `meta.total` on an existing offset-paginated list call with
 * `pageSize: 1`, so the payload cost is minimal regardless of how many
 * rows actually match.
 */
import { computed, onMounted, ref } from 'vue';
import { PhBadge, PhButton, PhCard, PhProgressBar, useToast } from '@phishyhub/design-system';
import * as usersApi from '../../../api/endpoints/users';
import * as departmentsApi from '../../../api/endpoints/departments';
import StatCard from '../components/StatCard.vue';
import { ALL_USER_ROLES, USER_ROLE_LABELS } from '../lib/roles';
import { useAiStore } from '../../../stores/ai';
import { useAuthStore } from '../../../stores/auth';
import { canManageAiIndex } from '../../../lib/permissions';
import { isApiError } from '../../../api/errors';
import type { UserRole } from '../../../api/types';

const loading = ref(true);
const totalUsers = ref(0);
const totalDepartments = ref(0);
const byRole = ref<Partial<Record<UserRole, number>>>({});

const aiStore = useAiStore();
const authStore = useAuthStore();
const toast = useToast();
const reindexing = ref(false);

const canTriggerReindex = computed(() => canManageAiIndex(authStore.user));

/**
 * Prefers the live `ai:index:progress` event (has file/chunk counts a run
 * row alone doesn't expose mid-flight) while a run is active; falls back to
 * the last-known `status.activeRun` snapshot from `GET /ai/status` once no
 * live progress event has arrived yet for this page load.
 */
const activeRun = computed(() => aiStore.status?.activeRun ?? null);
const progressPercent = computed(() => {
  const progress = aiStore.indexProgress;
  if (progress && progress.totalFiles > 0) {
    return Math.round((progress.filesProcessed / progress.totalFiles) * 100);
  }
  return null;
});

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

  try {
    await aiStore.fetchStatus();
  } catch {
    // Best-effort — the card below just shows "unknown" state if this fails.
  }
});

async function onReindex(): Promise<void> {
  reindexing.value = true;
  try {
    await aiStore.triggerReindex();
    toast.push({ title: 'Reindex started', variant: 'success' });
  } catch (err) {
    toast.push({
      title: 'Could not start reindex',
      description: isApiError(err) ? err.message : 'Please try again.',
      variant: 'danger',
    });
  } finally {
    reindexing.value = false;
  }
}
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

    <PhCard class="admin-overview-view__ai-card">
      <template #header>
        <div class="admin-overview-view__ai-card-header">
          <h2 class="admin-overview-view__ai-card-title">AI Index</h2>
          <PhBadge v-if="aiStore.status" :variant="aiStore.status.enabled ? 'success' : 'default'">
            {{ aiStore.status.enabled ? 'Enabled' : 'Disabled' }}
          </PhBadge>
        </div>
      </template>

      <div class="admin-overview-view__ai-card-body">
        <template v-if="activeRun">
          <p class="admin-overview-view__ai-stat">
            Run status: <strong>{{ activeRun.status }}</strong>
          </p>
          <p class="admin-overview-view__ai-stat">
            Files: {{ aiStore.indexProgress?.filesProcessed ?? activeRun.fileCount }}{{ aiStore.indexProgress ? ` / ${aiStore.indexProgress.totalFiles}` : '' }}
          </p>
          <p class="admin-overview-view__ai-stat">Chunks embedded: {{ aiStore.indexProgress?.chunkCount ?? activeRun.embeddedChunkCount }} / {{ activeRun.chunkCount }}</p>
          <PhProgressBar v-if="progressPercent !== null" :value="progressPercent" label="Indexing progress" />
        </template>
        <p v-else class="admin-overview-view__ai-stat">No active index run.</p>

        <PhButton v-if="canTriggerReindex" size="sm" variant="secondary" :loading="reindexing" @click="onReindex">
          Reindex
        </PhButton>
      </div>
    </PhCard>
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

.admin-overview-view__ai-card {
  max-width: 420px;
}

.admin-overview-view__ai-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ph-space-2);
}

.admin-overview-view__ai-card-title {
  margin: 0;
  font-size: var(--ph-font-size-md);
  font-weight: var(--ph-font-weight-semibold);
  color: var(--ph-color-text-default);
}

.admin-overview-view__ai-card-body {
  display: flex;
  flex-direction: column;
  gap: var(--ph-space-2);
}

.admin-overview-view__ai-stat {
  margin: 0;
  font-size: var(--ph-font-size-sm);
  color: var(--ph-color-text-muted);
}
</style>
