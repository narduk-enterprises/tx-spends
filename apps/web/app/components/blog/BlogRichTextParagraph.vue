<script setup lang="ts">
import { parseBlogRichText } from '~/utils/blog'

const props = defineProps<{
  text: string
}>()

const tokens = computed(() => parseBlogRichText(props.text))
</script>

<template>
  <p class="whitespace-pre-wrap">
    <template v-for="(token, index) in tokens" :key="`${token.type}-${index}`">
      <NuxtLink
        v-if="token.type === 'link'"
        :to="token.href"
        :prefetch="false"
        class="font-medium text-primary underline decoration-primary/40 underline-offset-4 transition hover:text-primary/80 hover:decoration-primary"
      >
        {{ token.text }}
      </NuxtLink>
      <span v-else>{{ token.text }}</span>
    </template>
  </p>
</template>
