<script setup lang="ts">
import { computed, ref, watch } from 'vue';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const props = withDefaults(
  defineProps<{
    src?: string;
    alt?: string;
    /** Fallback text shown when there's no image (or it fails to load) — typically initials. */
    initials?: string;
    size?: AvatarSize;
  }>(),
  {
    src: undefined,
    alt: '',
    initials: '',
    size: 'md',
  },
);

const imageFailed = ref(false);

watch(
  () => props.src,
  () => {
    imageFailed.value = false;
  },
);

const showImage = computed(() => Boolean(props.src) && !imageFailed.value);
</script>

<template>
  <span class="ph-avatar" :class="`ph-avatar--${size}`">
    <img v-if="showImage" class="ph-avatar__image" :src="src" :alt="alt" @error="imageFailed = true" />
    <span v-else class="ph-avatar__initials" aria-hidden="true">{{ initials }}</span>
    <span v-if="alt && !showImage" class="ph-visually-hidden">{{ alt }}</span>
    <span class="ph-avatar__presence">
      <slot name="presence" />
    </span>
  </span>
</template>

<style scoped>
.ph-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--ph-radius-full);
  background-color: var(--ph-color-accent-subtle);
  color: var(--ph-color-accent-subtle-text);
  font-weight: var(--ph-font-weight-semibold);
  overflow: hidden;
  user-select: none;
}

.ph-avatar--xs {
  width: 24px;
  height: 24px;
  font-size: var(--ph-font-size-xs);
}

.ph-avatar--sm {
  width: 32px;
  height: 32px;
  font-size: var(--ph-font-size-xs);
}

.ph-avatar--md {
  width: 40px;
  height: 40px;
  font-size: var(--ph-font-size-sm);
}

.ph-avatar--lg {
  width: 56px;
  height: 56px;
  font-size: var(--ph-font-size-lg);
}

.ph-avatar--xl {
  width: 80px;
  height: 80px;
  font-size: var(--ph-font-size-2xl);
}

.ph-avatar__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ph-avatar__initials {
  line-height: 1;
  text-transform: uppercase;
}

.ph-avatar__presence {
  position: absolute;
  right: 0;
  bottom: 0;
  line-height: 0;
}
</style>
