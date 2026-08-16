# @phishyhub/design-system

Standalone, presentational Vue 3 component and design-token library for Phishy Hub. Consumed by the chat SPA (`web/`) and, later, the Electron wrapper and ERP dashboards.

**This package is presentational-only.** Components import zero of: `pinia`, `vue-router`, any API/HTTP client, or any socket client. No app state, no navigation, no network — everything a component needs comes in via props/slots/emits. That's what lets unrelated apps reuse the same components without dragging chat-specific concerns along. Don't add a dependency here that breaks that rule.

## Using it from `web/`

Import the stylesheet once, at the app's entry point:

```ts
// web/src/main.ts
import '@phishyhub/design-system/styles.css';
```

Import components per-file, as needed:

```vue
<script setup lang="ts">
import { PhButton, PhModal, useToast } from '@phishyhub/design-system';
</script>
```

Both `web/` and `packages/*` are npm workspaces (see the root `package.json`), so no separate publish/install step is needed during development — changes here are picked up directly.

## Design tokens

Two tiers, both defined as CSS custom properties in `src/styles/tokens/`:

- **Tier 1 — primitives** (`primitives.css`): raw scale values (`--ph-palette-slate-500`, `--ph-space-4`, `--ph-radius-md`, ...). Never reference these directly outside of this file.
- **Tier 2 — semantic** (`semantic.css`): the tokens components actually consume (`--ph-color-text-default`, `--ph-color-accent`, `--ph-color-border-subtle`, ...). Each maps to a tier-1 primitive. This indirection is what lets the whole app re-theme at runtime — flipping `<html data-theme="dark">` (or matching the OS `prefers-color-scheme`) swaps every semantic token's value with no rebuild, which the future Electron OS-theme-follow feature depends on.

**Rule: component `<style scoped>` blocks reference `var(--ph-color-*)` (and other tier-2 tokens) only — never a hardcoded hex value, and never a tier-1 primitive directly.** If a component needs a color semantic.css doesn't have yet, add the semantic token (mapped to an existing or new primitive) rather than reaching past it.

Spacing, radius, and shadow tokens (`--ph-space-*`, `--ph-radius-*`, `--ph-shadow-*`) live in tier 1 only — they don't change between themes, so components reference them directly without a semantic indirection layer.

`src/tokens/index.ts` exports the token **names** (e.g. `TOKEN_COLOR_ACCENT = '--ph-color-accent'`) and TS union types for them — never values. Values only ever live in CSS, which is what keeps runtime theme switching possible.

## Theming

`useTheme()` reads/writes `document.documentElement.dataset.theme` (`'light' | 'dark'`) and persists the explicit choice to `localStorage` under `phishyhub.theme`. With no explicit choice, `semantic.css` falls back to the OS `prefers-color-scheme`.

## Structure

```
src/
  index.ts              barrel — components + composables
  styles/
    index.css            single CSS entry point (import this once)
    reset.css
    tokens/primitives.css
    tokens/semantic.css
    tokens/typography.css
    utilities.css
  tokens/index.ts         token NAMES + TYPES (no values)
  components/<Name>/<Name>.vue + index.ts
  composables/            useTheme, useToast, useFocusTrap, useClickOutside, useId
```

## Kanban board + calendar/table primitives

Five components added for the Kanban board + HR calendar feature. Same rules as everything else here: presentational only, no pinia/router/HTTP/socket imports, consumer owns real state.

### `PhBoard` / `PhBoardColumn` / `PhBoardCard`

Native HTML5 drag-and-drop primitives (no third-party DnD library — this package stays zero-runtime-dependency by design). **These components never mutate data — they only ever emit an intent.** The consumer (a Pinia store in `web/`) owns the optimistic update, the server call, and rollback-on-failure.

```vue
<PhBoard @item-move="onItemMove">
  <PhBoardColumn column-id="todo" title="To do" :count="todoCards.length">
    <PhBoardCard v-for="card in todoCards" :key="card.id" :item-id="card.id">
      {{ card.title }}
    </PhBoardCard>
  </PhBoardColumn>
  <PhBoardColumn column-id="done" title="Done" :can-drop="isAssigneeOrAdmin">
    …
  </PhBoardColumn>
</PhBoard>
```

- **`PhBoard`** — horizontal scrollable row of columns (rendered by the consumer via the default slot). Emits `item-move: { itemId, fromColumnId, toColumnId }` whenever a drag-drop (or a keyboard "Move to…" selection) completes.
- **`PhBoardColumn`** — props `columnId: string`, `title: string`, `count?: number` (badge), `canDrop?: (itemId: string) => boolean`. The design system never knows about roles/permissions — `canDrop` is how the consumer expresses "only the assignee or an admin may drop here." When `canDrop` returns false during a dragover, the column shows a muted/rejected-drop overlay and the drop is blocked. Card content goes in the default slot.
- **`PhBoardCard`** — props `itemId: string`, `draggable?: boolean` (default `true`; set `false` to disable dragging a card the current user isn't allowed to move). Emits `dragstart` / `dragend` (e.g. to dim other UI during a drag) — the actual move-intent is always `PhBoard`'s `item-move`, never this component's.
- **Accessibility**: native HTML5 DnD doesn't work on touch and needs a keyboard fallback regardless, so every `PhBoardCard` also renders a "Move to…" `<select>` (visually hidden until it receives focus, same technique as a skip-link) listing every other column registered under the same `PhBoard`. Choosing an option fires the same `item-move` event a mouse drag-drop would, so keyboard/touch users get full parity, not a degraded experience.

### `PhDateInput`

Thin wrapper over `<input type="date">`, matching `PhInput`'s bare-control chrome (this package has no label/error/description wrapper on any form control today — that's composed by consumers). Props: `modelValue?: string`, `disabled?`, `invalid?`, `id?`, `min?: string`, `max?: string` (native date-range attributes, `'YYYY-MM-DD'`). Emits `update:modelValue` with the raw `'YYYY-MM-DD'` string from the native input — never wrapped in a JS `Date`, so date-only values stay timezone-safe.

### `PhCalendarMonth`

A month-grid calendar for showing per-day content — **not** a date picker (no selection state, just the grid). Props: `year: number`, `month: number` (1-12). Emits `navigate: { year, month }` when the prev/next arrows are clicked — the consumer owns whether/how navigation actually changes what's displayed. Renders weekday headers, correct day-of-week alignment, and dims leading/trailing days from adjacent months; per-cell content is entirely up to the consumer via the scoped default slot:

```vue
<PhCalendarMonth :year="2026" :month="8" @navigate="({ year, month }) => goTo(year, month)">
  <template #default="{ date, isToday, isCurrentMonth }">
    <LeavePill v-for="leave in leavesByDate[date]" :key="leave.id" :leave="leave" />
  </template>
</PhCalendarMonth>
```

Grid math is done with UTC day-arithmetic (`Date.UTC`), never local-timezone `Date` parsing of a date string, so cells can't shift by a day near a local midnight/DST boundary.

### `PhTable`

Generic data table. Props: `columns: PhTableColumn[]` (`{ key, label, sortable?, width? }`), `rows: T[]`, `loading?: boolean`, `rowKey?: (row, index) => string | number`, `emptyTitle?`, `emptyDescription?`, `skeletonRows?` (default `4`). Emits `sort: { key, direction: 'asc' | 'desc' }` when a sortable header is clicked — `PhTable` only tracks/toggles/displays the sort indicator, the consumer re-sorts `rows` itself. Per-column custom cell content via a dynamic scoped slot named `#cell-<columnKey>` (receives `{ row, value, rowIndex }`). Reuses `PhSkeleton` for the loading state and `PhEmptyState` for the empty state.

### `PhProgressBar`

Horizontal progress bar. Props: `value: number`, `max?: number` (default `100`), `label?: string`, `variant?: 'default' | 'success' | 'warning' | 'danger'`. Accessible: `role="progressbar"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax`.

## Adding a component

1. `src/components/PhThing/PhThing.vue` — `<script setup lang="ts">`, scoped styles using only semantic tokens, props/emits/slots for everything it needs from the outside world.
2. `src/components/PhThing/index.ts` — `export { default as PhThing } from './PhThing.vue';` (plus any exported prop types).
3. Add both lines to `src/index.ts`.
4. Keyboard/ARIA: match the existing patterns (`PhModal` for focus-trap + Escape, `PhDropdown`/`PhTabs` for arrow-key navigation) where relevant.

## Type-checking

```
npm run typecheck -w @phishyhub/design-system
```

Runs `vue-tsc --noEmit`. There's no build step or bundler here yet — consumers import `.ts`/`.vue` source directly — so this is the correctness bar until `web/` exists to smoke-test against.
