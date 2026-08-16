import { reactive, readonly } from 'vue';
import { useId } from './useId';

export type ToastVariant = 'default' | 'success' | 'danger' | 'warning';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  /** Milliseconds before auto-dismiss. 0 disables auto-dismiss. */
  duration: number;
}

export interface PushToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

const DEFAULT_DURATION = 5000;

// Module-level queue shared by every `useToast()` call, so any component
// can push a toast and `PhToastHost` (mounted once near the app root)
// renders the resulting queue.
const toasts = reactive<Toast[]>([]);
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function dismiss(id: string): void {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index !== -1) {
    toasts.splice(index, 1);
  }
}

function push(options: PushToastOptions): string {
  const id = useId('toast');
  const duration = options.duration ?? DEFAULT_DURATION;
  toasts.push({
    id,
    title: options.title,
    description: options.description,
    variant: options.variant ?? 'default',
    duration,
  });

  if (duration > 0) {
    timers.set(
      id,
      setTimeout(() => dismiss(id), duration),
    );
  }

  return id;
}

function clear(): void {
  for (const toast of [...toasts]) {
    dismiss(toast.id);
  }
}

/**
 * Push/dismiss API backing `PhToastHost`. Call `push()` from anywhere
 * (no provider/context needed — state is module-level) and mount a single
 * `<PhToastHost />` near the app root to render the resulting queue.
 */
export function useToast() {
  return {
    toasts: readonly(toasts),
    push,
    dismiss,
    clear,
  };
}
