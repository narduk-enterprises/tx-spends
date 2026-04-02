import type { MaybeRefOrGetter } from 'vue'

interface WebPageOptions {
  name?: MaybeRefOrGetter<string | undefined>
  description?: MaybeRefOrGetter<string | undefined>
  type?:
    | 'WebPage'
    | 'AboutPage'
    | 'ContactPage'
    | 'CollectionPage'
    | 'FAQPage'
    | 'ItemPage'
    | 'SearchResultsPage'
}

export function useWebPageSchema(options: WebPageOptions = {}) {
  const { name, description, type = 'WebPage' } = options
  const resolvedName = toValue(name as MaybeRefOrGetter<string | undefined>)
  const resolvedDescription = toValue(description as MaybeRefOrGetter<string | undefined>)

  useSchemaOrg([
    defineWebPage({
      '@type': type,
      name: resolvedName,
      description: resolvedDescription,
    }),
  ])
}
