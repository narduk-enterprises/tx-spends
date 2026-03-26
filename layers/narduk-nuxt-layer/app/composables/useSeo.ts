/**
 * useSeo — One-call composable for complete per-page SEO.
 *
 * Wraps `useSeoMeta()`, `useHead()`, and `defineOgImage()` into a single
 * ergonomic API. Every page should call this in its `<script setup>` block.
 *
 * @example
 * ```ts
 * // Minimal — just title + description
 * useSeo({
 *   title: 'About Us',
 *   description: 'Learn more about our team and mission.',
 * })
 *
 * // Full — with OG image, article metadata, canonical override
 * useSeo({
 *   title: 'How to Deploy Nuxt 4',
 *   description: 'Step-by-step guide to deploying Nuxt 4 on Cloudflare Workers.',
 *   image: '/images/deploy-guide.png',
 *   type: 'article',
 *   publishedAt: '2026-02-20',
 *   modifiedAt: '2026-02-25',
 *   author: 'Jane Doe',
 *   canonicalUrl: 'https://example.com/blog/deploy-nuxt-4',
 *   ogImage: {
 *     title: 'How to Deploy Nuxt 4',
 *     description: 'Step-by-step guide',
 *     icon: 'i-lucide-rocket',
 *   },
 * })
 * ```
 */

import { computed, toValue, type MaybeRefOrGetter } from 'vue'

type SeoTextValue = MaybeRefOrGetter<string | undefined>
type SeoTypeValue = MaybeRefOrGetter<'website' | 'article' | 'profile' | undefined>
type SeoKeywordsValue = MaybeRefOrGetter<string[] | undefined>

interface SeoOptions {
  /** Page title (used in <title>, og:title, twitter:title) */
  title: SeoTextValue
  /** Page description (used in <meta name="description">, og:description, twitter:description) */
  description: SeoTextValue
  /** Static image URL for og:image / twitter:image. Overridden by `ogImage` if set. */
  image?: SeoTextValue
  /** Open Graph type — defaults to 'website'. Use 'article' for blog posts. */
  type?: SeoTypeValue
  /** ISO 8601 date string — for articles */
  publishedAt?: SeoTextValue
  /** ISO 8601 date string — for articles */
  modifiedAt?: SeoTextValue
  /** Author name — for articles */
  author?: SeoTextValue
  /** Override canonical URL (defaults to current page URL via @nuxtjs/seo) */
  canonicalUrl?: SeoTextValue
  /** Keywords for meta keywords tag */
  keywords?: SeoKeywordsValue
  /** Dynamic OG image options — renders via OG image templates at the edge */
  ogImage?: {
    title?: SeoTextValue
    description?: SeoTextValue
    icon?: SeoTextValue
    /** OG image component name suffix — defaults to 'Default', auto-selects 'Article' for article type */
    component?: SeoTextValue
    /** Category badge text — used by the Article template */
    category?: SeoTextValue
  }
  /** Additional robots directives — e.g., 'noindex', 'nofollow' */
  robots?: SeoTextValue
}

export function useSeo(options: SeoOptions) {
  const {
    title,
    description,
    image,
    type = 'website',
    publishedAt,
    modifiedAt,
    author,
    canonicalUrl,
    keywords,
    ogImage,
    robots,
  } = options

  const resolvedTitle = computed(() => toValue(title) ?? '')
  const resolvedDescription = computed(() => toValue(description) ?? '')
  const resolvedType = computed(() => toValue(type) ?? 'website')
  const resolvedImage = image ? computed(() => toValue(image)) : undefined
  const resolvedPublishedAt = publishedAt
    ? computed(() => (resolvedType.value === 'article' ? toValue(publishedAt) : undefined))
    : undefined
  const resolvedModifiedAt = modifiedAt
    ? computed(() => (resolvedType.value === 'article' ? toValue(modifiedAt) : undefined))
    : undefined
  const resolvedAuthor = author ? computed(() => toValue(author)) : undefined
  const resolvedArticleAuthor = resolvedAuthor
    ? computed(() => {
        const authorValue = resolvedAuthor.value
        return resolvedType.value === 'article' && authorValue ? [authorValue] : undefined
      })
    : undefined
  const resolvedKeywords = keywords
    ? computed(() => {
        const keywordValues = toValue(keywords)
        return keywordValues?.length ? keywordValues.join(', ') : undefined
      })
    : undefined
  const resolvedRobots = robots ? computed(() => toValue(robots)) : undefined

  // --- Core meta tags (no intermediate Record<string, any>) ---
  useSeoMeta({
    title: resolvedTitle,
    description: resolvedDescription,
    ogTitle: resolvedTitle,
    ogDescription: resolvedDescription,
    // ogType accepts 'website' | 'article' | 'profile' etc.
    ogType: resolvedType,
    twitterCard: 'summary_large_image',
    twitterTitle: resolvedTitle,
    twitterDescription: resolvedDescription,
    // Static image fallback
    ...(resolvedImage && { ogImage: resolvedImage, twitterImage: resolvedImage }),
    // Article-specific
    ...(resolvedPublishedAt && { articlePublishedTime: resolvedPublishedAt }),
    ...(resolvedModifiedAt && { articleModifiedTime: resolvedModifiedAt }),
    ...(resolvedArticleAuthor && { articleAuthor: resolvedArticleAuthor }),
    // Keywords
    ...(resolvedKeywords && { keywords: resolvedKeywords }),
    // Robots
    ...(resolvedRobots && { robots: resolvedRobots }),
  })

  // --- Head extras ---
  if (canonicalUrl !== undefined) {
    useHead({
      link: [{ rel: 'canonical', href: computed(() => toValue(canonicalUrl) ?? '') }],
    })
  }

  // Dynamic OG: nuxt-og-image only applies on SSR; the client stub warns in dev if called.
  if (ogImage && import.meta.server) {
    const componentName = toValue(ogImage.component) || (resolvedType.value === 'article' ? 'Article' : 'Default')
    // OgImage component names are registered at the consuming-app level;
    // the layer can't enumerate them at type-check time.
    defineOgImage(componentName as never, {
      title: toValue(ogImage.title) || resolvedTitle.value,
      description: toValue(ogImage.description) || resolvedDescription.value,
      icon: toValue(ogImage.icon) || '✨',
      ...(toValue(ogImage.category) && { category: toValue(ogImage.category) }),
    })
  }
}
