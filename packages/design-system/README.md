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
