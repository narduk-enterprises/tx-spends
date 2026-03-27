<script setup lang="ts">
import { splitBlogParagraphs } from '~/utils/blog'

interface BlogPostSection {
  heading?: string
  content?: string
}

interface BlogPostBody {
  intro?: string
  sections?: BlogPostSection[]
  dataNotes?: string
}

defineProps<{
  body?: BlogPostBody | null
}>()

function paragraphs(text: string | null | undefined): string[] {
  return splitBlogParagraphs(text)
}
</script>

<template>
  <div class="space-y-6 text-base leading-relaxed text-default">
    <template v-for="(paragraph, index) in paragraphs(body?.intro)" :key="`intro-${index}`">
      <BlogRichTextParagraph :text="paragraph" class="text-base leading-relaxed" />
    </template>

    <template v-if="body?.sections?.length">
      <section
        v-for="(section, sectionIndex) in body.sections"
        :key="`${section.heading || 'section'}-${sectionIndex}`"
        class="space-y-3"
      >
        <h2 class="text-xl font-semibold text-default">
          {{ section.heading || `Section ${sectionIndex + 1}` }}
        </h2>

        <template
          v-for="(paragraph, paragraphIndex) in paragraphs(section.content)"
          :key="`${sectionIndex}-${paragraphIndex}`"
        >
          <BlogRichTextParagraph :text="paragraph" class="leading-relaxed text-default/90" />
        </template>
      </section>
    </template>

    <aside
      v-if="paragraphs(body?.dataNotes).length > 0"
      class="rounded-2xl border border-default bg-muted/30 p-4 text-sm text-muted"
    >
      <p class="mb-1 font-semibold text-default">Data Notes</p>

      <template v-for="(paragraph, index) in paragraphs(body?.dataNotes)" :key="`note-${index}`">
        <BlogRichTextParagraph :text="paragraph" :class="index > 0 ? 'mt-3' : ''" />
      </template>
    </aside>
  </div>
</template>
