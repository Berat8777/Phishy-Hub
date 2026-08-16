<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import MentionAutocomplete from './MentionAutocomplete.vue';
import { mentionToken, parseBodySegments } from '../../../../lib/mentions';
import { useUsersStore } from '../../../../stores/users';
import type { UserDTO } from '../../../../api/types';

/**
 * Slack/Discord-style composer: a `contenteditable` div that shows mention
 * chips inline while typing (instead of the raw `<@uuid>` wire token — that
 * only looked right AFTER sending, via MessageBody.vue's rendering). The
 * DOM is the editing surface; `modelValue` stays the exact same
 * `<@uuid>`-token plain-text wire format the rest of the app already
 * expects (drafts store, send payload) — it's derived from the DOM on every
 * change (`serializeDom`) and, conversely, only re-rendered INTO the DOM
 * when it changes for a reason other than our own last emit (channel
 * switch, draft restore, post-send clear) — see `lastSyncedValue` below.
 *
 * `PhTextarea` doesn't apply here (no contenteditable support in the design
 * system yet), so this owns its own minimal textarea-alike styling instead.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string;
    disabled?: boolean;
    placeholder?: string;
  }>(),
  { disabled: false, placeholder: 'Message…' },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  submit: [];
  typing: [];
  blur: [];
}>();

const usersStore = useUsersStore();
const editorRef = ref<HTMLDivElement | null>(null);
const isEmpty = ref(true);

const mentionQuery = ref<string | null>(null);
/** The exact text node + offset where the active "@query" starts, so a selected mention can replace precisely that span — recomputed on every input/caret-move while a query is active. */
let mentionMatch: { node: Text; start: number } | null = null;
const autocompleteRef = ref<InstanceType<typeof MentionAutocomplete> | null>(null);

/** Sends the exact string most recently produced FROM this component's own DOM — a `modelValue` prop change that still equals this is our own echo, not an external change, and shouldn't re-render the DOM (which would clobber the caret mid-type). */
let lastSyncedValue = props.modelValue;

function clearMentionState(): void {
  mentionQuery.value = null;
  mentionMatch = null;
}

/** Reads the live Selection to find an in-progress "@query" ending at the caret, mirroring the old plain-text regex but scoped to whatever text node the caret is actually in (chips are separate, non-text nodes, so they never interfere). */
function updateMentionState(): void {
  const editor = editorRef.value;
  const selection = window.getSelection();
  if (!editor || !selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    clearMentionState();
    return;
  }
  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE || !editor.contains(node)) {
    clearMentionState();
    return;
  }
  const text = node.textContent ?? '';
  const caret = range.startOffset;
  const upToCaret = text.slice(0, caret);
  const match = /(?:^|\s)@([^\s@]{0,32})$/.exec(upToCaret);
  if (match) {
    const query = match[1] as string;
    mentionMatch = { node: node as Text, start: caret - query.length - 1 };
    mentionQuery.value = query;
  } else {
    clearMentionState();
  }
}

/** Walks the editable DOM, turning it back into the `<@uuid>`-token wire format: text nodes verbatim, `.mention-chip` spans back into tokens, `<br>` into `\n`. */
function serializeDom(): string {
  const editor = editorRef.value;
  if (!editor) return '';
  let out = '';
  const walk = (node: ChildNode): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? '';
      return;
    }
    if (node.nodeName === 'BR') {
      out += '\n';
      return;
    }
    if (node instanceof HTMLElement && node.classList.contains('mention-chip')) {
      out += mentionToken(node.dataset.userId ?? '');
      return;
    }
    if (node instanceof HTMLElement) {
      // Defensive fallback for any other element that ends up in here (e.g.
      // a pasted block that slipped past onPaste's plain-text coercion) —
      // recurse into it and treat it as its own line rather than dropping
      // its text or crashing.
      node.childNodes.forEach(walk);
      if (node.nodeName === 'DIV' || node.nodeName === 'P') out += '\n';
    }
  };
  editor.childNodes.forEach(walk);
  return out;
}

function updateEmptyState(): void {
  isEmpty.value = !editorRef.value || editorRef.value.childNodes.length === 0;
}

/** Re-derives `modelValue` from the current DOM after a programmatic mutation (chip insert, line break, paste) — NOT tied to the native `input` event, so it doesn't also emit `typing` (matches the old textarea version, where selecting a mention didn't itself count as "typing"). */
function syncFromDom(): void {
  const value = serializeDom();
  lastSyncedValue = value;
  updateEmptyState();
  emit('update:modelValue', value);
}

function onNativeInput(): void {
  syncFromDom();
  emit('typing');
  updateMentionState();
}

function onCaretMoved(): void {
  updateMentionState();
}

/** Renders a wire-format string INTO the editable DOM — mount, and any `modelValue` change that didn't originate from this component itself (channel switch restoring a different draft, MessageComposer clearing the draft after a successful send, etc). */
function renderModelValueIntoDom(value: string): void {
  const editor = editorRef.value;
  if (!editor) return;
  editor.innerHTML = '';
  for (const segment of parseBodySegments(value)) {
    if (segment.type === 'mention') {
      editor.appendChild(buildMentionChip(segment.userId));
      continue;
    }
    const raw = segment.type === 'link' ? segment.url : segment.value;
    const lines = raw.split('\n');
    lines.forEach((line, index) => {
      if (index > 0) editor.appendChild(document.createElement('br'));
      if (line) editor.appendChild(document.createTextNode(line));
    });
  }
  updateEmptyState();
}

function mentionChipLabel(userId: string): string {
  const user = usersStore.getUser(userId);
  return user ? `@${user.firstName} ${user.lastName}` : `@${userId.slice(0, 8)}…`;
}

function buildMentionChip(userId: string): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = 'mention-chip';
  chip.contentEditable = 'false';
  chip.dataset.userId = userId;
  chip.textContent = mentionChipLabel(userId);
  return chip;
}

/**
 * Best-effort: if a restored draft mentions a user this client hasn't
 * loaded yet, the chip briefly shows a truncated-id fallback
 * (`mentionChipLabel`) — fetch the missing users and re-render once they're
 * in, but only if the editor still holds exactly the value we rendered
 * (otherwise the user has since typed something and re-rendering would
 * clobber their caret).
 */
async function resolveMissingMentionNames(value: string): Promise<void> {
  const ids = new Set(
    parseBodySegments(value)
      .filter((s): s is { type: 'mention'; userId: string } => s.type === 'mention')
      .map((s) => s.userId)
      .filter((id) => !usersStore.getUser(id)),
  );
  if (ids.size === 0) return;
  await Promise.all(Array.from(ids).map((id) => usersStore.fetchUser(id).catch(() => undefined)));
  if (lastSyncedValue === value) renderModelValueIntoDom(value);
}

function onSelectMention(user: UserDTO): void {
  const editor = editorRef.value;
  const match = mentionMatch;
  if (!editor || !match) return;

  const selection = window.getSelection();
  const currentText = match.node.textContent ?? '';
  const caretOffset =
    selection && selection.rangeCount && match.node.contains(selection.getRangeAt(0).startContainer)
      ? selection.getRangeAt(0).startOffset
      : currentText.length;

  usersStore.upsert(user);
  const before = currentText.slice(0, match.start);
  const after = currentText.slice(caretOffset);
  const beforeNode = document.createTextNode(before);
  const chip = buildMentionChip(user.id);
  // Trailing space so typing continues normally right after the chip, per
  // task brief — also gives Backspace-right-after-chip somewhere unambiguous
  // to detect (see onKeydown's Backspace handling below). Skipped if `after`
  // already starts with whitespace (mention selected mid-text, e.g.
  // "Hello @sam world" -> "Hello <chip> world") to avoid a double space.
  const needsSpace = !after.startsWith(' ');
  const afterNode = document.createTextNode(needsSpace ? ` ${after}` : after);
  match.node.replaceWith(beforeNode, chip, afterNode);

  const range = document.createRange();
  range.setStart(afterNode, needsSpace ? 1 : 0);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);

  clearMentionState();
  syncFromDom();
  editor.focus();
}

/**
 * A manual `Range.insertNode(br)` + `setStartAfter(br)` leaves the caret
 * positioned "after the br, with no following node" whenever the break is
 * at the very end of the content — Chromium's own native typing then
 * inserts the *next* typed character BEFORE that trailing `<br>` instead of
 * after it (it treats a dangling trailing `<br>` as an end-of-content
 * placeholder, not a real caret anchor). `execCommand('insertLineBreak')`
 * delegates to the browser's own well-tested line-break-insertion + caret
 * placement instead of re-deriving it by hand — still broadly supported
 * despite the "deprecated" execCommand label, and this is exactly the kind
 * of caret-placement edge case it's still the most reliable tool for.
 */
function insertLineBreak(): void {
  let handled = false;
  try {
    handled = document.execCommand('insertLineBreak');
  } catch {
    handled = false;
  }
  if (!handled) {
    // Known-imperfect fallback, not a fully equivalent substitute: this is
    // the exact manual Range approach the comment above describes as
    // buggy (trailing-caret-after-br placement) — it only exists so a
    // browser without `execCommand('insertLineBreak')` support still gets
    // *a* line break inserted rather than none at all. Acceptable for an
    // internal tool targeting evergreen Chromium/Firefox/Safari, where
    // `handled` is expected to always be true in practice.
    const selection = window.getSelection();
    if (selection && selection.rangeCount) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const br = document.createElement('br');
      range.insertNode(br);
      range.setStartAfter(br);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
  syncFromDom();
  updateMentionState();
}

/** Forces pasted content to plain text — pasting rich HTML (e.g. from a webpage) would otherwise inject foreign markup `serializeDom` was never meant to round-trip. */
function onPaste(event: ClipboardEvent): void {
  event.preventDefault();
  const text = event.clipboardData?.getData('text/plain') ?? '';
  if (!text) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const fragment = document.createDocumentFragment();
  text.split('\n').forEach((line, index) => {
    if (index > 0) fragment.appendChild(document.createElement('br'));
    if (line) fragment.appendChild(document.createTextNode(line));
  });
  range.insertNode(fragment);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  syncFromDom();
  updateMentionState();
}

/** A mention chip is atomic — Backspace/Delete right next to one removes the whole node instead of leaving the browser to (inconsistently, across engines) peel at it character by character. */
function chipAdjacentTo(range: Range, direction: 'before' | 'after'): HTMLElement | null {
  const { startContainer, startOffset } = range;
  if (startContainer.nodeType === Node.TEXT_NODE) {
    if (direction === 'before' && startOffset === 0) {
      const sibling = startContainer.previousSibling;
      return sibling instanceof HTMLElement && sibling.classList.contains('mention-chip') ? sibling : null;
    }
    if (direction === 'after' && startOffset === (startContainer.textContent ?? '').length) {
      const sibling = startContainer.nextSibling;
      return sibling instanceof HTMLElement && sibling.classList.contains('mention-chip') ? sibling : null;
    }
    return null;
  }
  if (startContainer.nodeType === Node.ELEMENT_NODE) {
    const index = direction === 'before' ? startOffset - 1 : startOffset;
    const node = startContainer.childNodes[index];
    return node instanceof HTMLElement && node.classList.contains('mention-chip') ? node : null;
  }
  return null;
}

function removeChip(chip: HTMLElement): void {
  chip.remove();
  syncFromDom();
  updateMentionState();
}

function onKeydown(event: KeyboardEvent): void {
  if (mentionQuery.value !== null) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      autocompleteRef.value?.moveNext();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      autocompleteRef.value?.movePrev();
      return;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      if (autocompleteRef.value?.selectActive()) {
        event.preventDefault();
        return;
      }
    }
    if (event.key === 'Escape') {
      clearMentionState();
      return;
    }
  }

  if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault();
    insertLineBreak();
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    emit('submit');
    return;
  }

  if ((event.key === 'Backspace' || event.key === 'Delete') && !event.shiftKey) {
    const selection = window.getSelection();
    if (selection && selection.isCollapsed && selection.rangeCount) {
      const chip = chipAdjacentTo(selection.getRangeAt(0), event.key === 'Backspace' ? 'before' : 'after');
      if (chip) {
        event.preventDefault();
        removeChip(chip);
      }
    }
  }
}

watch(
  () => props.modelValue,
  (value) => {
    if (value === lastSyncedValue) return;
    lastSyncedValue = value;
    renderModelValueIntoDom(value);
    void resolveMissingMentionNames(value);
  },
);

onMounted(() => {
  renderModelValueIntoDom(props.modelValue);
  void resolveMissingMentionNames(props.modelValue);
});
</script>

<template>
  <div class="composer-input">
    <div v-if="mentionQuery !== null" class="composer-input__mentions">
      <MentionAutocomplete ref="autocompleteRef" :query="mentionQuery" @select="onSelectMention" />
    </div>
    <div
      ref="editorRef"
      class="composer-input__editor"
      :class="{ 'composer-input__editor--empty': isEmpty, 'composer-input__editor--disabled': disabled }"
      :contenteditable="!disabled"
      role="textbox"
      aria-multiline="true"
      :aria-placeholder="placeholder"
      :data-placeholder="placeholder"
      @input="onNativeInput"
      @keydown="onKeydown"
      @keyup="onCaretMoved"
      @click="onCaretMoved"
      @paste="onPaste"
      @blur="emit('blur')"
    />
  </div>
</template>

<style scoped>
.composer-input {
  position: relative;
}

.composer-input__mentions {
  position: absolute;
  bottom: 100%;
  left: 0;
  z-index: 20;
  margin-bottom: var(--ph-space-1);
  max-height: 200px;
  overflow-y: auto;
  padding: var(--ph-space-1);
  background-color: var(--ph-color-surface-overlay);
  border: 1px solid var(--ph-color-border-subtle);
  border-radius: var(--ph-radius-md);
  box-shadow: var(--ph-shadow-md);
}

.composer-input__editor {
  width: 100%;
  min-height: 40px;
  max-height: 200px;
  overflow-y: auto;
  padding: var(--ph-space-2) var(--ph-space-3);
  background-color: var(--ph-color-surface-raised);
  border: 1px solid var(--ph-color-border-strong);
  border-radius: var(--ph-radius-md);
  color: var(--ph-color-text-default);
  font-family: var(--ph-font-family-base);
  font-size: var(--ph-font-size-md);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  transition:
    border-color var(--ph-duration-fast) var(--ph-easing-standard),
    box-shadow var(--ph-duration-fast) var(--ph-easing-standard);
}

.composer-input__editor:hover:not(.composer-input__editor--disabled) {
  border-color: var(--ph-color-border-focus);
}

.composer-input__editor:focus-visible {
  outline: none;
  border-color: var(--ph-color-border-focus);
  box-shadow: var(--ph-focus-ring);
}

.composer-input__editor--empty::before {
  content: attr(data-placeholder);
  color: var(--ph-color-text-subtle);
  pointer-events: none;
}

.composer-input__editor--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.composer-input__editor :deep(.mention-chip) {
  display: inline;
  padding: 0 4px;
  border-radius: var(--ph-radius-sm);
  background-color: var(--ph-color-accent-subtle);
  color: var(--ph-color-accent-subtle-text);
  font-weight: var(--ph-font-weight-medium);
}
</style>
