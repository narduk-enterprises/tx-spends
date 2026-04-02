import { toValue, type MaybeRefOrGetter } from 'vue'

type SeoField<T> = MaybeRefOrGetter<T>
type SeoGraphType = 'website' | 'article' | 'profile'

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
  title: SeoField<string>
  /** Page description (used in <meta name="description">, og:description, twitter:description) */
  description: SeoField<string>
  /** Static image URL for og:image / twitter:image. Overridden by `ogImage` if set. */
  image?: SeoField<string | undefined>
  /** Open Graph type — defaults to 'website'. Use 'article' for blog posts. */
  type?: SeoField<SeoGraphType | undefined>
  /** ISO 8601 date string — for articles */
  publishedAt?: SeoField<string | undefined>
  /** ISO 8601 date string — for articles */
  modifiedAt?: SeoField<string | undefined>
  /** Author name — for articles */
  author?: SeoField<string | undefined>
  /** Override canonical URL (defaults to current page URL via @nuxtjs/seo) */
  canonicalUrl?: SeoField<string | undefined>
  /** Keywords for meta keywords tag */
  keywords?: SeoField<string[] | undefined>
  /** Dynamic OG image options — renders via OG image templates at the edge */
  ogImage?: {
    title?: SeoField<string | undefined>
    description?: SeoField<string | undefined>
    icon?: SeoField<string | undefined>
    /** OG image component name suffix — defaults to 'Default', auto-selects 'Article' for article type */
    component?: SeoField<string | undefined>
    /** Category badge text — used by the Article template */
    category?: SeoField<string | undefined>
  }
  /** Additional robots directives — e.g., 'noindex', 'nofollow' */
  robots?: SeoField<string | undefined>
}

function resolveSeoField<T>(value: SeoField<T> | undefined): T | undefined {
  return value === undefined ? undefined : toValue(value)
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

  // --- Core meta tags (no intermediate Record<string, any>) ---
  useSeoMeta({
    title: () => resolveSeoField(title) ?? '',
    description: () => resolveSeoField(description) ?? '',
    ogTitle: () => resolveSeoField(title) ?? '',
    ogDescription: () => resolveSeoField(description) ?? '',
    // ogType accepts 'website' | 'article' | 'profile' etc.
    ogType: () => resolveSeoField(type) ?? 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: () => resolveSeoField(title) ?? '',
    twitterDescription: () => resolveSeoField(description) ?? '',
    // Static image fallback
    ogImage: () => resolveSeoField(image),
    twitterImage: () => resolveSeoField(image),
    // Article-specific
    articlePublishedTime: () =>
      resolveSeoField(type) === 'article' ? resolveSeoField(publishedAt) : undefined,
    articleModifiedTime: () =>
      resolveSeoField(type) === 'article' ? resolveSeoField(modifiedAt) : undefined,
    articleAuthor: () => {
      const resolvedAuthor = resolveSeoField(author)
      return resolveSeoField(type) === 'article' && resolvedAuthor ? [resolvedAuthor] : undefined
    },
    // Keywords
    keywords: () => {
      const resolvedKeywords = resolveSeoField(keywords)
      return resolvedKeywords?.length ? resolvedKeywords.join(', ') : undefined
    },
    // Robots
    robots: () => resolveSeoField(robots),
  })

  // --- Head extras ---
  useHead(() => {
    const href = resolveSeoField(canonicalUrl)
    return href ? { link: [{ rel: 'canonical', href }] } : {}
  })

  // Dynamic OG: nuxt-og-image only applies on SSR; the client stub warns in dev if called.
  if (ogImage && import.meta.server) {
    const resolvedType = resolveSeoField(type) ?? 'website'
    const componentName =
      resolveSeoField(ogImage.component) || (resolvedType === 'article' ? 'Article' : 'Default')
    // OgImage component names are registered at the consuming-app level;
    // the layer can't enumerate them at type-check time.
    defineOgImage(componentName as never, {
      title: resolveSeoField(ogImage.title) || resolveSeoField(title) || '',
      description: resolveSeoField(ogImage.description) || resolveSeoField(description) || '',
      icon: resolveSeoField(ogImage.icon) || '✨',
      ...(resolveSeoField(ogImage.category) && { category: resolveSeoField(ogImage.category) }),
    })
  }
}
