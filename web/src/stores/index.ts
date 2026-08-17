import { useChannelsStore } from './channels';
import { useMessagesStore } from './messages';
import { useThreadsStore } from './threads';
import { usePresenceStore } from './presence';
import { useTypingStore } from './typing';
import { useUsersStore } from './users';
import { useDepartmentsStore } from './departments';
import { useFilesStore } from './files';
import { useNotificationsStore } from './notifications';
import { useDraftsStore } from './drafts';
import { useSearchStore } from './search';
import { useUserProfileStore } from './userProfile';
import { useAiStore } from './ai';
import { useTicketsStore } from '../features/boards/stores/tickets';
import { useTicketCommentsStore } from '../features/boards/stores/ticketComments';
import { useLeaveStore } from '../features/hr/stores/leave';
import { useAdminStore } from '../features/admin/stores/admin';

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
  useDepartmentsStore().reset();
  useFilesStore().reset();
  useNotificationsStore().reset();
  useDraftsStore().reset();
  useSearchStore().reset();
  // The open-profile-modal pointer is UI state, not cached data, but still
  // session-scoped (a stale userId open across a device-shared logout would
  // be a minor but real cross-user leak — the modal would briefly show the
  // NEXT user the PREVIOUS user's profile until it re-renders).
  useUserProfileStore().reset();
  // Cross-user data-leak risk on a shared device if forgotten (tickets/
  // comments have no per-user visibility restriction, CONTRACT.md §1.4, so a
  // stale cache would show the PREVIOUS user's board contents until refetch).
  useTicketsStore().reset();
  useTicketCommentsStore().reset();
  // Same cross-user data-leak risk as tickets above — leave requests/balance
  // and the admin user/department tables are equally sensitive on a shared
  // device and have no per-user visibility restriction baked into the cache
  // key, so a stale cache would leak the PREVIOUS user's data until refetch.
  useLeaveStore().reset();
  useAdminStore().reset();
  // Same cross-user leak risk as tickets/leave above — a streamed answer
  // buffer or query history left over from the previous session on a shared
  // device would otherwise briefly show the NEXT user someone else's AI
  // conversation.
  useAiStore().reset();
}
