import { describe, expect, it } from 'vitest'
import { BLOG_AUTHOR_NAME, parseBlogRichText, splitBlogParagraphs } from '../../app/utils/blog'

describe('BLOG_AUTHOR_NAME', () => {
  it('uses the fixed public byline name', () => {
    expect(BLOG_AUTHOR_NAME).toBe('Logan Renz')
  })
})

describe('splitBlogParagraphs', () => {
  it('splits content on blank lines and trims whitespace', () => {
    expect(splitBlogParagraphs(' First paragraph \n\n Second paragraph \n')).toEqual([
      'First paragraph',
      'Second paragraph',
    ])
  })
})

describe('parseBlogRichText', () => {
  it('parses root-relative markdown links into structured link tokens', () => {
    const tokens = parseBlogRichText(
      'See the [agency table](/agencies?fy=2025&q=Health%20and%20Human%20Services%20Commission).',
    )

    expect(tokens).toEqual([
      { type: 'text', text: 'See the ' },
      {
        type: 'link',
        text: 'agency table',
        href: '/agencies?fy=2025&q=Health%20and%20Human%20Services%20Commission',
      },
      { type: 'text', text: '.' },
    ])
  })

  it('leaves unsupported protocols as plain escaped text', () => {
    const tokens = parseBlogRichText('Bad [link](javascript:alert(1))')

    expect(tokens).toEqual([{ type: 'text', text: 'Bad [link](javascript:alert(1))' }])
  })
})
