import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'

type SeoValue<T> = MaybeRefOrGetter<T>

function readSeoValue<T>(value: SeoValue<T>) {
  return toValue(value)
}

function readOptionalSeoValue<T>(value?: SeoValue<T>) {
  return value === undefined ? undefined : readSeoValue(value)
}

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

interface SeoOptions {
  /** Page title (used in <title>, og:title, twitter:title) */
  title: SeoValue<string>
  /** Page description (used in <meta name="description">, og:description, twitter:description) */
  description: SeoValue<string>
  /** Static image URL for og:image / twitter:image. Overridden by `ogImage` if set. */
  image?: SeoValue<string | undefined>
  /** Open Graph type — defaults to 'website'. Use 'article' for blog posts. */
  type?: SeoValue<'website' | 'article' | 'profile'>
  /** ISO 8601 date string — for articles */
  publishedAt?: SeoValue<string | undefined>
  /** ISO 8601 date string — for articles */
  modifiedAt?: SeoValue<string | undefined>
  /** Author name — for articles */
  author?: SeoValue<string | undefined>
  /** Override canonical URL (defaults to current page URL via @nuxtjs/seo) */
  canonicalUrl?: SeoValue<string | undefined>
  /** Keywords for meta keywords tag */
  keywords?: SeoValue<string[] | undefined>
  /** Dynamic OG image options — renders via OG image templates at the edge */
  ogImage?: {
    title?: SeoValue<string | undefined>
    description?: SeoValue<string | undefined>
    icon?: SeoValue<string | undefined>
    /** OG image component name suffix — defaults to 'Default', auto-selects 'Article' for article type */
    component?: SeoValue<string | undefined>
    /** Category badge text — used by the Article template */
    category?: SeoValue<string | undefined>
  }
  /** Additional robots directives — e.g., 'noindex', 'nofollow' */
  robots?: SeoValue<string | undefined>
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

  const getTitle = () => readSeoValue(title)
  const getDescription = () => readSeoValue(description)
  const getType = () => readOptionalSeoValue(type) ?? 'website'
  const getImage = () => readOptionalSeoValue(image)
  const getPublishedAt = () => readOptionalSeoValue(publishedAt)
  const getModifiedAt = () => readOptionalSeoValue(modifiedAt)
  const getAuthor = () => readOptionalSeoValue(author)
  const getCanonicalUrl = () => readOptionalSeoValue(canonicalUrl)
  const getKeywords = () => readOptionalSeoValue(keywords)
  const getRobots = () => readOptionalSeoValue(robots)

  // --- Core meta tags (no intermediate Record<string, any>) ---
  useSeoMeta({
    title: getTitle,
    description: getDescription,
    ogTitle: getTitle,
    ogDescription: getDescription,
    // ogType accepts 'website' | 'article' | 'profile' etc.
    ogType: getType,
    twitterCard: 'summary_large_image',
    twitterTitle: getTitle,
    twitterDescription: getDescription,
    ogImage: getImage,
    twitterImage: getImage,
    // Article-specific
    articlePublishedTime: () => (getType() === 'article' ? getPublishedAt() : undefined),
    articleModifiedTime: () => (getType() === 'article' ? getModifiedAt() : undefined),
    articleAuthor: () => {
      const resolvedAuthor = getAuthor()
      return getType() === 'article' && resolvedAuthor ? [resolvedAuthor] : undefined
    },
    // Keywords
    keywords: () => getKeywords()?.join(', ') || undefined,
    // Robots
    robots: getRobots,
  })

  // --- Head extras ---
  useHead({
    link: () => {
      const resolvedCanonicalUrl = getCanonicalUrl()
      return resolvedCanonicalUrl ? [{ rel: 'canonical', href: resolvedCanonicalUrl }] : []
    },
  })

  // Dynamic OG: nuxt-og-image only applies on SSR; the client stub warns in dev if called.
  if (ogImage && import.meta.server) {
    const componentName =
      readOptionalSeoValue(ogImage.component) || (getType() === 'article' ? 'Article' : 'Default')
    // OgImage component names are registered at the consuming-app level;
    // the layer can't enumerate them at type-check time.
    defineOgImage(componentName as never, {
      title: () => readOptionalSeoValue(ogImage.title) || getTitle(),
      description: () => readOptionalSeoValue(ogImage.description) || getDescription(),
      icon: () => readOptionalSeoValue(ogImage.icon) || '✨',
      category: () => readOptionalSeoValue(ogImage.category),
    })
  }
}
