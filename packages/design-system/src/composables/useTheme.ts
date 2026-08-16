import { ref, type Ref } from 'vue';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'phishyhub.theme';

function readStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

function applyTheme(theme: Theme | null): void {
  if (typeof document === 'undefined') return;
  if (theme) {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

// Module-level so every `useTheme()` call anywhere in the app shares one
// source of truth instead of drifting out of sync with each other.
const theme: Ref<Theme | null> = ref(readStoredTheme());
applyTheme(theme.value);

export interface UseThemeReturn {
  /** Current theme, or `null` when following the OS `prefers-color-scheme`. */
  theme: Ref<Theme | null>;
  /** Explicitly set the theme and persist the choice. */
  setTheme: (next: Theme) => void;
  /** Toggle between light and dark, treating `null` (OS default) as light. */
  toggleTheme: () => void;
  /** Clear the explicit choice and fall back to the OS `prefers-color-scheme`. */
  clearTheme: () => void;
}

/**
 * Reads/writes the app's theme via `document.documentElement.dataset.theme`,
 * persisting the explicit choice to localStorage. When no explicit choice
 * has been made, the CSS layer falls back to `prefers-color-scheme` on its
 * own — this composable only needs to manage the override.
 */
export function useTheme(): UseThemeReturn {
  function setTheme(next: Theme): void {
    theme.value = next;
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  function toggleTheme(): void {
    setTheme(theme.value === 'dark' ? 'light' : 'dark');
  }

  function clearTheme(): void {
    theme.value = null;
    applyTheme(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return { theme, setTheme, toggleTheme, clearTheme };
}
