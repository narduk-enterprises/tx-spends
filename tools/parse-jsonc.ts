import { parse, type ParseError, printParseErrorCode } from 'jsonc-parser'

/**
 * Parse JSONC (JSON with // and block comments, trailing commas) — matches wrangler.jsonc.
 */
export function parseJsonc(text: string): unknown {
  const errors: ParseError[] = []
  const value = parse(text, errors, { allowTrailingComma: true })
  if (errors.length > 0) {
    const detail = errors.map((e) => printParseErrorCode(e.error)).join('; ')
    throw new SyntaxError(`JSONC parse failed: ${detail}`)
  }
  return value
}
