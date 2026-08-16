import { ref } from 'vue';
import { defineStore } from 'pinia';
import { useTheme } from '@phishyhub/design-system';

const SIDEBAR_STORAGE_KEY = 'phishyhub.ui.sidebarCollapsed';

function readSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
}

/**
 * Device/user preferences — deliberately NOT included in the hard-logout
 * `resetAllStores()` sweep (stores/index.ts). Theme and sidebar state are
 * per-device UI preferences, not session data, so there's no reason to wipe
 * them just because a session ended.
 */
export const useUiStore = defineStore('ui', () => {
  const { theme, setTheme, toggleTheme, clearTheme } = useTheme();
  const sidebarCollapsed = ref(readSidebarCollapsed());

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed.value));
  }

  function setSidebarCollapsed(value: boolean): void {
    sidebarCollapsed.value = value;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
  }

  return { theme, setTheme, toggleTheme, clearTheme, sidebarCollapsed, toggleSidebar, setSidebarCollapsed };
});
