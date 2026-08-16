<script setup lang="ts">
import { computed } from 'vue';
import ReactionPill from './ReactionPill.vue';
import type { MessageReactionSummary } from '../../../../api/types';

const props = defineProps<{
  reactions: MessageReactionSummary[];
  currentUserId: string;
}>();

const emit = defineEmits<{ toggle: [emoji: string] }>();

// Deliberately NOT trusting `reaction.reactedByMe` here — it's only accurate
// on REST responses; anything that arrived via the `reaction:added`/
// `reaction:removed` socket broadcast always has it `false`
// (CONTRACT.md §3.6/§9). Checking `userIds` against the local user id is the
// reliable path the contract itself recommends.
const visible = computed(() => props.reactions.filter((r) => r.count > 0));

function isMine(reaction: MessageReactionSummary): boolean {
  return reaction.userIds.includes(props.currentUserId);
}
</script>

<template>
  <div v-if="visible.length" class="message-reactions">
    <ReactionPill
      v-for="reaction in visible"
      :key="reaction.emoji"
      :emoji="reaction.emoji"
      :count="reaction.count"
      :reacted-by-me="isMine(reaction)"
      @toggle="emit('toggle', reaction.emoji)"
    />
  </div>
</template>

<style scoped>
.message-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ph-space-1);
  margin-top: var(--ph-space-1);
}
</style>
