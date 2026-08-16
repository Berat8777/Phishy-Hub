/**
 * Minimal concurrency-limited task runner — no external dependency needed
 * for the one place this is used (batching per-DM-channel member lookups in
 * the sidebar, capped so a workspace with many DMs doesn't fire unlimited
 * parallel `GET /channels/:id/members` requests).
 */
export function createLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  function next(): void {
    if (active >= concurrency) return;
    const run = queue.shift();
    if (!run) return;
    active += 1;
    run();
  }

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            next();
          });
      });
      next();
    });
  };
}
