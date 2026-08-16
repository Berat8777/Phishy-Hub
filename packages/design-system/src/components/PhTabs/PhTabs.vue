<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useId } from '../../composables/useId';

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
}

const props = defineProps<{
  modelValue: string;
  tabs: TabItem[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const groupId = useId('tabs');

const listRef = ref<HTMLElement | null>(null);
const tabRefs = new Map<string, HTMLElement>();
// A 1px-wide base, stretched via `scaleX` — keeps the sliding indicator
// animation to transform-only (never width/left), per the no-layout-jank
// motion rule.
const indicatorStyle = ref<{ transform: string; opacity: number }>({ transform: 'translateX(0) scaleX(0)', opacity: 0 });

function setTabRef(id: string, el: Element | null): void {
  if (el instanceof HTMLElement) {
    tabRefs.set(id, el);
  } else {
    tabRefs.delete(id);
  }
}

function updateIndicator(): void {
  const list = listRef.value;
  const activeEl = tabRefs.get(props.modelValue);
  if (!list || !activeEl) {
    indicatorStyle.value = { ...indicatorStyle.value, opacity: 0 };
    return;
  }
  const listRect = list.getBoundingClientRect();
  const tabRect = activeEl.getBoundingClientRect();
  const offset = tabRect.left - listRect.left + list.scrollLeft;
  indicatorStyle.value = {
    transform: `translateX(${offset}px) scaleX(${tabRect.width})`,
    opacity: 1,
  };
}

watch(
  () => props.modelValue,
  () => nextTick(updateIndicator),
);

watch(
  () => props.tabs,
  () => nextTick(updateIndicator),
  { deep: true },
);

function onWindowResize(): void {
  updateIndicator();
}

onMounted(async () => {
  await nextTick();
  updateIndicator();
  window.addEventListener('resize', onWindowResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize);
});

function tabId(id: string): string {
  return `${groupId}-tab-${id}`;
}

function panelId(id: string): string {
  return `${groupId}-panel-${id}`;
}

function select(tab: TabItem): void {
  if (tab.disabled) return;
  emit('update:modelValue', tab.id);
}

/**
 * Focuses (and selects) the tab at `index`, wrapping around the ends.
 * If that tab is disabled, keeps stepping in `direction` until it finds
 * an enabled one, rather than stopping dead on the disabled tab.
 */
function focusTab(index: number, direction: 1 | -1 = 1, attempts = props.tabs.length): void {
  if (attempts <= 0 || props.tabs.length === 0) return;
  const clamped = ((index % props.tabs.length) + props.tabs.length) % props.tabs.length;
  const target = props.tabs[clamped];
  if (target.disabled) {
    focusTab(clamped + direction, direction, attempts - 1);
    return;
  }
  const el = document.getElementById(tabId(target.id));
  el?.focus();
  select(target);
}

function onKeydown(event: KeyboardEvent, currentIndex: number): void {
  switch (event.key) {
    case 'ArrowRight':
      event.preventDefault();
      focusTab(currentIndex + 1, 1);
      break;
    case 'ArrowLeft':
      event.preventDefault();
      focusTab(currentIndex - 1, -1);
      break;
    case 'Home':
      event.preventDefault();
      focusTab(0, 1);
      break;
    case 'End':
      event.preventDefault();
      focusTab(props.tabs.length - 1, -1);
      break;
  }
}
</script>

<template>
  <div class="ph-tabs">
    <div ref="listRef" class="ph-tabs__list" role="tablist">
      <button
        v-for="(tab, index) in tabs"
        :id="tabId(tab.id)"
        :key="tab.id"
        :ref="(el) => setTabRef(tab.id, el as Element | null)"
        type="button"
        role="tab"
        class="ph-tabs__tab"
        :class="{ 'ph-tabs__tab--active': tab.id === modelValue }"
        :aria-selected="tab.id === modelValue"
        :aria-controls="panelId(tab.id)"
        :disabled="tab.disabled"
        :tabindex="tab.id === modelValue ? 0 : -1"
        @click="select(tab)"
        @keydown="onKeydown($event, index)"
      >
        {{ tab.label }}
      </button>
      <span class="ph-tabs__indicator" aria-hidden="true" :style="{ transform: indicatorStyle.transform, opacity: indicatorStyle.opacity }" />
    </div>
    <div
      v-for="tab in tabs"
      :id="panelId(tab.id)"
      :key="tab.id"
      class="ph-tabs__panel"
      role="tabpanel"
      :aria-labelledby="tabId(tab.id)"
      v-show="tab.id === modelValue"
    >
      <slot :name="tab.id" />
    </div>
  </div>
</template>

<style scoped>
.ph-tabs__list {
  position: relative;
  display: flex;
  gap: var(--ph-space-1);
  border-bottom: 1px solid var(--ph-color-border-subtle);
}

.ph-tabs__tab {
  padding: var(--ph-space-2) var(--ph-space-3);
  font-size: var(--ph-font-size-sm);
  font-weight: var(--ph-font-weight-medium);
  color: var(--ph-color-text-muted);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color var(--ph-duration-fast) var(--ph-easing-standard);
}

.ph-tabs__tab:hover:not(:disabled) {
  color: var(--ph-color-text-default);
}

.ph-tabs__tab:focus-visible {
  outline: none;
  box-shadow: var(--ph-focus-ring);
  border-radius: var(--ph-radius-sm);
}

.ph-tabs__tab:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.ph-tabs__tab--active {
  color: var(--ph-color-accent);
}

/*
 * Sliding active-tab indicator. Positioned at the bottom of `.ph-tabs__list`
 * (replacing the old per-tab `border-bottom-color` snap) and animated via
 * `transform: translateX(...) scaleX(...)` only — a 1px-wide base stretched
 * with `scaleX` avoids animating `width`/`left`, which would thrash layout.
 */
.ph-tabs__indicator {
  position: absolute;
  left: 0;
  bottom: -1px;
  width: 1px;
  height: 2px;
  background-color: var(--ph-color-accent);
  transform-origin: left center;
  transition: transform var(--ph-duration-base) var(--ph-easing-standard), opacity var(--ph-duration-fast) var(--ph-easing-standard);
}

.ph-tabs__panel {
  padding-top: var(--ph-space-4);
}
</style>
