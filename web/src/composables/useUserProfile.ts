import { useUserProfileStore } from '../stores/userProfile';

/**
 * Ergonomic entry point for opening the global user-profile modal
 * (`components/shared/UserProfileModal.vue`, mounted once in `App.vue`)
 * from anywhere in the app — chat's `UserPopover`, the admin users table,
 * a future `ChannelMembersPanel`, etc. Backed by `stores/userProfile.ts`
 * (a Pinia store, so state is a true app-wide singleton); this composable
 * just gives call sites a small, stable `{ open, close }` surface instead
 * of importing the store directly everywhere.
 */
export function useUserProfile(): { open: (userId: string) => void; close: () => void } {
  const store = useUserProfileStore();
  return { open: store.open, close: store.close };
}
