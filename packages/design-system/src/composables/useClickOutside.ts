import { onBeforeUnmount, onMounted, type Ref } from 'vue';

type ElRef = Ref<HTMLElement | null | undefined>;

/**
 * Invokes `handler` when a pointer event fires outside of ALL of the given
 * element(s). Accepts either a single ref or an array of refs — pass every
 * element the "outside" check must exclude, e.g. both a trigger's wrapper
 * and a `Teleport`-ed content panel that isn't a DOM descendant of it.
 * Used by components like PhDropdown/PhPopover to close on outside click.
 */
export function useClickOutside(elRefs: ElRef | ElRef[], handler: (event: PointerEvent) => void): void {
  const refs = Array.isArray(elRefs) ? elRefs : [elRefs];

  function onPointerDown(event: PointerEvent): void {
    const target = event.target as Node | null;
    if (!target) return;
    const isInside = refs.some((ref) => ref.value?.contains(target));
    if (!isInside) {
      handler(event);
    }
  }

  onMounted(() => {
    document.addEventListener('pointerdown', onPointerDown, true);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onPointerDown, true);
  });
}
