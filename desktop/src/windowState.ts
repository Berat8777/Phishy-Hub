import fs from 'node:fs';
import path from 'node:path';
import type { Display } from 'electron';

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

export const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1280,
  height: 800,
  isMaximized: false,
};

const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;
const STATE_FILE_NAME = 'window-state.json';

function stateFilePath(userDataDir: string): string {
  return path.join(userDataDir, STATE_FILE_NAME);
}

/**
 * Reads persisted bounds from `<userData>/window-state.json`. Falls back to
 * `DEFAULT_WINDOW_STATE` on first run or a missing/corrupt/partial file —
 * this must never throw, a bad state file shouldn't block launch.
 */
export function loadWindowState(userDataDir: string): WindowState {
  try {
    const raw = fs.readFileSync(stateFilePath(userDataDir), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<WindowState>;
    if (typeof parsed.width !== 'number' || typeof parsed.height !== 'number') {
      return { ...DEFAULT_WINDOW_STATE };
    }
    return {
      x: typeof parsed.x === 'number' ? parsed.x : undefined,
      y: typeof parsed.y === 'number' ? parsed.y : undefined,
      width: parsed.width,
      height: parsed.height,
      isMaximized: Boolean(parsed.isMaximized),
    };
  } catch {
    return { ...DEFAULT_WINDOW_STATE };
  }
}

/** Best-effort persistence — a failed write just means next launch falls back to defaults, not worth surfacing to the user. */
export function saveWindowState(userDataDir: string, state: WindowState): void {
  try {
    fs.writeFileSync(stateFilePath(userDataDir), JSON.stringify(state), 'utf-8');
  } catch {
    // ignored, see comment above
  }
}

/**
 * Guards against restoring a position that's no longer on any connected
 * display (e.g. the window was last positioned on a second monitor that's
 * since been unplugged) — if the saved `{x,y}` doesn't fall inside any
 * display's work area, both are dropped so BrowserWindow falls back to its
 * own centered default instead of opening off-screen. Width/height are
 * always clamped to fit within the primary display's work area.
 */
export function clampToVisibleArea(state: WindowState, displays: Display[]): WindowState {
  const primary = displays.find((d) => d.bounds.x === 0 && d.bounds.y === 0) ?? displays[0];
  const maxWidth = primary ? Math.max(primary.workArea.width, MIN_WIDTH) : state.width;
  const maxHeight = primary ? Math.max(primary.workArea.height, MIN_HEIGHT) : state.height;

  const width = Math.min(Math.max(state.width, MIN_WIDTH), maxWidth);
  const height = Math.min(Math.max(state.height, MIN_HEIGHT), maxHeight);

  const fitsOnScreen =
    state.x !== undefined &&
    state.y !== undefined &&
    displays.some((d) => {
      const { x, y, width: w, height: h } = d.workArea;
      return state.x! >= x && state.y! >= y && state.x! < x + w && state.y! < y + h;
    });

  return {
    x: fitsOnScreen ? state.x : undefined,
    y: fitsOnScreen ? state.y : undefined,
    width,
    height,
    isMaximized: state.isMaximized,
  };
}
