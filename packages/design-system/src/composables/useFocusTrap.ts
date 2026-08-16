import { onBeforeUnmount, watch, type Ref } from 'vue';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Traps Tab/Shift+Tab focus cycling within `containerRef`'s element, and
 * restores focus to whatever was focused beforehand once the container
 * goes away. Used by PhModal so keyboard/AT users can't tab out to the
 * page behind an overlay.
 *
 * Activation is driven by watching `containerRef` itself (not the owning
 * component's mount lifecycle), because consumers like PhModal keep a
 * single component instance alive and toggle the container element via
 * `v-if` — the trap needs to engage/disengage on that toggle, not once
 * at PhModal's own mount time.
 */
export function useFocusTrap(containerRef: Ref<HTMLElement | null | undefined>): void {
  let previouslyFocused: HTMLElement | null = null;
  let active = false;

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const container = containerRef.value;
    if (!container) return;

    const focusable = getFocusable(container);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeEl = document.activeElement;

    if (event.shiftKey) {
      if (activeEl === first || !container.contains(activeEl)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (activeEl === last || !container.contains(activeEl)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function activate(container: HTMLElement): void {
    if (active) return;
    active = true;
    previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = getFocusable(container);
    (focusable[0] ?? container).focus();
    document.addEventListener('keydown', onKeydown, true);
  }

  function deactivate(): void {
    if (!active) return;
    active = false;
    document.removeEventListener('keydown', onKeydown, true);
    previouslyFocused?.focus();
    previouslyFocused = null;
  }

  watch(
    containerRef,
    (container) => {
      if (container) {
        activate(container);
      } else {
        deactivate();
      }
    },
    { immediate: true, flush: 'post' },
  );

  onBeforeUnmount(deactivate);
}
