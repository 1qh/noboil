const SK_ANT_RE = /sk-ant-[\w-]{8,}/gu
const E2B_KEY_RE = /\be2b_[\w-]{8,}/gu
const JWT_RE = /eyJ[\w.-]{20,}/gu
const PROXY_TOKEN_RE = /proxy:[a-z0-9]+:[a-f0-9-]{36}/giu
const OPENAI_KEY_RE = /\bsk-[\w-]{20,}/gu
const AWS_ACCESS_KEY_RE = /\bAKIA[0-9A-Z]{16}\b/gu
const GITHUB_TOKEN_RE = /\bgh[opsu]_[A-Za-z0-9]{36,}/gu
const GOOGLE_KEY_RE = /\bAIza[\w-]{35}\b/gu
const COMBINED_RE = new RegExp(
  [
    String.raw`sk-ant-[\w-]{8,}`,
    String.raw`eyJ[\w.-]{20,}`,
    'proxy:[a-z0-9]+:[a-f0-9-]{36}',
    String.raw`\be2b_[\w-]{8,}`,
    String.raw`\bsk-[\w-]{20,}`,
    String.raw`\bAKIA[0-9A-Z]{16}\b`,
    String.raw`\bgh[opsu]_[a-z0-9]{36,}`,
    String.raw`\bAIza[\w-]{35}\b`
  ].join('|'),
  'giu'
)
/**
 * Replace common secret formats (sk-ant-, sk-, JWT, AWS access keys, GitHub tokens,
 * Google API keys, e2b_, proxy:tokens) with `[REDACTED]`. Use before logging untrusted
 * strings or LLM-rendered content. Conservative — only matches well-defined prefixes.
 */
const redactSecrets = (s: string): string => s.replaceAll(COMBINED_RE, '[REDACTED]')
export {
  AWS_ACCESS_KEY_RE,
  COMBINED_RE,
  E2B_KEY_RE,
  GITHUB_TOKEN_RE,
  GOOGLE_KEY_RE,
  JWT_RE,
  OPENAI_KEY_RE,
  PROXY_TOKEN_RE,
  redactSecrets,
  SK_ANT_RE
}
