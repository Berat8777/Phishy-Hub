import { useChannelsStore } from './channels';
import { useMessagesStore } from './messages';
import { useThreadsStore } from './threads';
import { usePresenceStore } from './presence';
import { useTypingStore } from './typing';
import { useUsersStore } from './users';
import { useFilesStore } from './files';
import { useNotificationsStore } from './notifications';
import { useDraftsStore } from './drafts';
import { useSearchStore } from './search';

/**
 * Resets every session-scoped Pinia store to its initial state. Called on
 * hard logout (auth store, triggered either manually or by
 * tokenManager.onSessionExpired) so a subsequent login on the same device
 * never sees a previous user's cached channels/messages/etc.
 *
 * Deliberately excludes `auth` (resets itself as part of the same logout
 * flow) and `ui` (theme/sidebar are device preferences, not session data).
 */
export function resetAllStores(): void {
  useChannelsStore().reset();
  useMessagesStore().reset();
  useThreadsStore().reset();
  usePresenceStore().reset();
  useTypingStore().reset();
  useUsersStore().reset();
  useFilesStore().reset();
  useNotificationsStore().reset();
  useDraftsStore().reset();
  useSearchStore().reset();
}
