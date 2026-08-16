import { ref } from 'vue';
import { defineStore } from 'pinia';

/**
 * Tiny cross-tree signal so a drag-drop over the AppShell region (which
 * wraps BOTH the `sidebar` and default named router-views — DropZone.vue
 * lives at that level, see AppShell.vue) can hand dropped files to
 * MessageComposer.vue, which is mounted several levels deeper inside the
 * `default` slot with no direct parent/child relationship to AppShell.
 *
 * Device/UI-transient state, not session data — deliberately excluded from
 * the hard-logout reset sweep (stores/index.ts), same rationale as `ui.ts`.
 */
export const useDropZoneStore = defineStore('dropzone', () => {
  const files = ref<File[]>([]);
  /** Bumped on every drop so a watcher on it (rather than on `files`, which could contain an unchanged reference) reliably fires even for repeat drops of the same File objects. */
  const version = ref(0);

  function pushFiles(dropped: File[]): void {
    files.value = dropped;
    version.value += 1;
  }

  return { files, version, pushFiles };
});
