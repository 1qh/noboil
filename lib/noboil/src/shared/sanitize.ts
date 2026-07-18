// eslint-disable-next-line regexp/control-character-escape -- explicit \u code points document the exact control-char range
const CONTROL_ASCII = String.raw`[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]`
const NEWLINES = String.raw`[\n\r\u0085\u2028\u2029]`
const UNICODE_CONTROL = String.raw`[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]`
const RE_CONTROL_ASCII = new RegExp(CONTROL_ASCII, 'gu')
const RE_NEWLINES = new RegExp(NEWLINES, 'gu')
const RE_UNICODE_CONTROL = new RegExp(UNICODE_CONTROL, 'gu')
// eslint-disable-next-line sonarjs/super-linear-regex -- linear: single bounded negated class, no ambiguous overlap
const RE_HTML_TAGS = /<[^>]*>/gu
// eslint-disable-next-line sonarjs/super-linear-regex -- linear: independent bounded negated classes, no ambiguous overlap
const RE_MD_LINK = /\[(?<text>[^\]]*)\]\([^)]*\)/gu
const RE_MD_IMAGE = /!\[[^\]]*\]\([^)]*\)/gu
const RE_CODE_BLOCK = /```[\s\S]*?```/gu
const RE_INLINE_CODE = /`[^`]*`/gu
const RE_HEADING = /#{1,6}\s/gu
const RE_SHELL_SUBST = /\$[({A-Z_]/gu
const RE_PIPE_SEMI = /[|;]/gu
/**
 * Make a string safe to render in HTML / Markdown UI: strips control + zero-width chars,
 * HTML-escapes `<` / `>`, truncates to `max` chars. Use for user-supplied content rendered
 * into your own UI. Does NOT remove links or formatting.
 */
const sanitizeForDisplay = (text: unknown, max = 4000): string => {
  if (typeof text !== 'string') return ''
  return text
    .replaceAll(RE_CONTROL_ASCII, '')
    .replaceAll(RE_UNICODE_CONTROL, '')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .slice(0, max)
}
/**
 * Aggressively flatten externally-fetched text (LLM output, scraped pages) into plain
 * single-line content: drops markdown links/images/code, HTML tags, headings, control
 * chars, newlines, shell-substitution sigils, and pipes. Use before logging or feeding
 * untrusted text into a downstream prompt / shell.
 */
const sanitizeExternal = (text: unknown, max = 500): string => {
  if (typeof text !== 'string') return ''
  return text
    .replaceAll(RE_CONTROL_ASCII, '')
    .replaceAll(RE_NEWLINES, ' ')
    .replaceAll(RE_HTML_TAGS, '')
    .replaceAll(RE_UNICODE_CONTROL, '')
    .replaceAll(RE_MD_LINK, '$<text>')
    .replaceAll(RE_MD_IMAGE, '')
    .replaceAll(RE_CODE_BLOCK, '')
    .replaceAll(RE_INLINE_CODE, '')
    .replaceAll(RE_HEADING, '')
    .replaceAll(RE_SHELL_SUBST, '_')
    .replaceAll('`', "'")
    .replaceAll(RE_PIPE_SEMI, ',')
    .slice(0, max)
}
/** Lowercase an email and (for Gmail) strip dots + `+suffix` so multiple aliases map to one identity. */
const canonicalizeEmail = (email: string): string => {
  const lower = email.trim().toLowerCase()
  const at = lower.indexOf('@')
  if (at === -1) return lower
  const local = lower.slice(0, at)
  const domain = lower.slice(at + 1)
  const plus = local.indexOf('+')
  const stripped = plus === -1 ? local : local.slice(0, plus)
  const noDots = domain === 'gmail.com' || domain === 'googlemail.com' ? stripped.replaceAll('.', '') : stripped
  return `${noDots}@${domain}`
}
const WHITESPACE_RE = /\s+/gu
const SENTENCE_SPLIT_RE = /[.!?]\s+/u
const QUESTION_WORD_RE = /\b(?:what|how|why|when|which|who|where|should|can|does|do|is|are)\b/iu
/** Trim/collapse whitespace, take first sentence, strip leading question words; fall back to `fallback` if empty. */
const sanitizeTitle = (s: string, maxLen = 80, fallback = 'Untitled'): string => {
  const cleaned = sanitizeExternal(s).replaceAll(WHITESPACE_RE, ' ').trim()
  if (!cleaned) return fallback
  const sentences = cleaned.split(SENTENCE_SPLIT_RE).filter(Boolean)
  const question = sentences.find(p => QUESTION_WORD_RE.test(p))
  const candidate = question ?? sentences[0] ?? cleaned
  if (candidate.length <= maxLen) return candidate
  const cut = candidate.slice(0, maxLen - 1)
  const lastSpace = cut.lastIndexOf(' ')
  const base = lastSpace > maxLen / 2 ? cut.slice(0, lastSpace).trim() : cut
  return `${base}…`
}
export { canonicalizeEmail, sanitizeExternal, sanitizeForDisplay, sanitizeTitle }
