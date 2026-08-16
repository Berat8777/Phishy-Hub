<script setup lang="ts">
import { PhToastHost } from '@phishyhub/design-system';
import UserProfileModal from './components/shared/UserProfileModal.vue';
</script>

<template>
  <router-view />
  <PhToastHost />
  <!-- Single global instance — any component can open it via `useUserProfile().open(userId)` (composables/useUserProfile.ts). -->
  <UserProfileModal />
</template>
