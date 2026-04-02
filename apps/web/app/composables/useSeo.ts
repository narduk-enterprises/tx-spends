import type { MaybeRefOrGetter } from 'vue'

type SeoField<T> = MaybeRefOrGetter<T>
type SeoGraphType = 'website' | 'article' | 'profile'

interface SeoOptions {
  title: SeoField<string>
  description: SeoField<string>
  image?: SeoField<string | undefined>
  type?: SeoField<SeoGraphType | undefined>
  publishedAt?: SeoField<string | undefined>
  modifiedAt?: SeoField<string | undefined>
  author?: SeoField<string | undefined>
  canonicalUrl?: SeoField<string | undefined>
  keywords?: SeoField<string[] | undefined>
  ogImage?: {
    title?: SeoField<string | undefined>
    description?: SeoField<string | undefined>
    icon?: SeoField<string | undefined>
    component?: SeoField<string | undefined>
    category?: SeoField<string | undefined>
  }
  robots?: SeoField<string | undefined>
}

function resolveSeoField<T>(value: SeoField<T> | undefined): T | undefined {
  return toValue(value as SeoField<T>)
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

  useSeoMeta({
    title: () => resolveSeoField(title) ?? '',
    description: () => resolveSeoField(description) ?? '',
    ogTitle: () => resolveSeoField(title) ?? '',
    ogDescription: () => resolveSeoField(description) ?? '',
    ogType: () => resolveSeoField(type) ?? 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: () => resolveSeoField(title) ?? '',
    twitterDescription: () => resolveSeoField(description) ?? '',
    ogImage: () => resolveSeoField(image),
    twitterImage: () => resolveSeoField(image),
    articlePublishedTime: () =>
      resolveSeoField(type) === 'article' ? resolveSeoField(publishedAt) : undefined,
    articleModifiedTime: () =>
      resolveSeoField(type) === 'article' ? resolveSeoField(modifiedAt) : undefined,
    articleAuthor: () => {
      const resolvedAuthor = resolveSeoField(author)
      return resolveSeoField(type) === 'article' && resolvedAuthor ? [resolvedAuthor] : undefined
    },
    keywords: () => {
      const resolvedKeywords = resolveSeoField(keywords)
      return resolvedKeywords?.length ? resolvedKeywords.join(', ') : undefined
    },
    robots: () => resolveSeoField(robots),
  })

  useHead(() => {
    const href = resolveSeoField(canonicalUrl)
    return href ? { link: [{ rel: 'canonical', href }] } : {}
  })

  onServerPrefetch(() => {
    if (!ogImage) return

    const resolvedType = resolveSeoField(type) ?? 'website'
    const componentName =
      resolveSeoField(ogImage.component) || (resolvedType === 'article' ? 'Article' : 'Default')

    defineOgImage(componentName as never, {
      title: resolveSeoField(ogImage.title) || resolveSeoField(title) || '',
      description: resolveSeoField(ogImage.description) || resolveSeoField(description) || '',
      icon: resolveSeoField(ogImage.icon) || '✨',
      ...(resolveSeoField(ogImage.category) && { category: resolveSeoField(ogImage.category) }),
    })
  })
}
