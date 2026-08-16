let counter = 0;

/**
 * Generates a stable, unique id for pairing labels with form controls
 * (e.g. `<label :for="id">` / `<input :id="id">`). Not SSR-shared state
 * (this app has no SSR today), but implemented as a module-level counter
 * rather than `Math.random()` so ids stay deterministic and collision-free
 * within a single render tree, keeping the door open if SSR is added later.
 */
export function useId(prefix = 'ph'): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
