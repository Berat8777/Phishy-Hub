import { ref } from 'vue';
import { defineStore } from 'pinia';

/**
 * Tracks which user's profile modal (if any) is currently open — a single
 * app-wide instance mounted once in `App.vue` (`UserProfileModal.vue`,
 * same "one global overlay, mount at the root" pattern as
 * `PhToastHost`/`useToast`). Any component, from any feature, can trigger
 * it via the `useUserProfile()` composable without needing to render its
 * own copy of the modal or thread props through the component tree.
 */
export const useUserProfileStore = defineStore('userProfile', () => {
  const openUserId = ref<string | null>(null);

  function open(userId: string): void {
    openUserId.value = userId;
  }

  function close(): void {
    openUserId.value = null;
  }

  function reset(): void {
    openUserId.value = null;
  }

  return { openUserId, open, close, reset };
});
