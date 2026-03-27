export const BLOG_AUTHOR_NAME = 'Logan Renz'

export type BlogRichTextToken =
  | { type: 'text'; text: string }
  | { type: 'link'; text: string; href: string }

function sanitizeInternalHref(value: string): string {
  const href = value.trim()
  if (!href.startsWith('/') || href.startsWith('//')) return ''
  return href
}

export function splitBlogParagraphs(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

export function parseBlogRichText(text: string | null | undefined): BlogRichTextToken[] {
  if (!text) return []

  const linkPattern = /\[([^[\]]+)\]\((\/[^)\s]+)\)/g
  const tokens: BlogRichTextToken[] = []
  let lastIndex = 0

  for (const match of text.matchAll(linkPattern)) {
    const fullMatch = match[0]
    const label = match[1] ?? ''
    const href = match[2] ?? ''
    const matchIndex = match.index ?? 0

    if (matchIndex > lastIndex) {
      tokens.push({
        type: 'text',
        text: text.slice(lastIndex, matchIndex),
      })
    }

    const safeHref = sanitizeInternalHref(href)
    if (safeHref) {
      tokens.push({
        type: 'link',
        text: label,
        href: safeHref,
      })
    } else {
      tokens.push({
        type: 'text',
        text: fullMatch,
      })
    }

    lastIndex = matchIndex + fullMatch.length
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      text: text.slice(lastIndex),
    })
  }

  return tokens
}
