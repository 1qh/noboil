/* eslint-disable no-script-url */
/* oxlint-disable no-script-url */
import { describe, expect, test } from 'bun:test'
import { extractDomain, extractSources, isSafeUrl, normalizeOrigin, parseSiteUrls, validateRedirectTo } from '../url'
describe('normalizeOrigin', () => {
  test('extracts origin lowercased', () => {
    expect(normalizeOrigin('HTTPS://Example.COM/path?q=1')).toBe('https://example.com')
  })
  test('invalid url returns empty', () => {
    expect(normalizeOrigin('not-a-url')).toBe('')
    expect(normalizeOrigin('')).toBe('')
  })
})
describe('parseSiteUrls', () => {
  test('CSV → urls + primary + origins', () => {
    const r = parseSiteUrls('https://a.com, https://b.com')
    expect(r.siteUrls).toEqual(['https://a.com', 'https://b.com'])
    expect(r.primary).toBe('https://a.com')
    expect(r.allowedOrigins.has('https://a.com')).toBe(true)
    expect(r.allowedOrigins.has('https://b.com')).toBe(true)
  })
  test('empty input', () => {
    const r = parseSiteUrls(undefined)
    expect(r.siteUrls).toEqual([])
    expect(r.primary).toBe('')
    expect(r.allowedOrigins.size).toBe(0)
  })
  test('skips invalid origins in allowed set', () => {
    const r = parseSiteUrls('https://valid.com, garbage')
    expect(r.siteUrls).toEqual(['https://valid.com', 'garbage'])
    expect(r.allowedOrigins.size).toBe(1)
  })
})
describe('isSafeUrl', () => {
  test('https URL is safe', () => {
    expect(isSafeUrl('https://example.com')).toBe(true)
  })
  test('http URL is not safe (https-only)', () => {
    expect(isSafeUrl('http://example.com')).toBe(false)
  })
  test('javascript:/data: rejected', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('data:text/html,foo')).toBe(false)
  })
  test('malformed URL', () => {
    expect(isSafeUrl('not a url')).toBe(false)
    expect(isSafeUrl('')).toBe(false)
  })
})
describe('extractDomain', () => {
  test('strips www and protocol', () => {
    expect(extractDomain('https://www.example.com/path')).toBe('example.com')
  })
  test('keeps subdomain other than www', () => {
    expect(extractDomain('https://api.example.com')).toBe('api.example.com')
  })
  test('falls back to input on parse failure', () => {
    expect(extractDomain('not-a-url')).toBe('not-a-url')
  })
})
describe('extractSources', () => {
  test('non-array → []', () => {
    expect(extractSources(null)).toEqual([])
    expect(extractSources('text')).toEqual([])
    expect(extractSources(undefined)).toEqual([])
  })
  test('extracts entries with url + title + domain', () => {
    const entries = extractSources([
      { title: 'Example', url: 'https://example.com/page' },
      { url: 'https://www.foo.com' },
      { url: 'http://insecure.com' },
      'plain text',
      null
    ])
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ domain: 'example.com', title: 'Example', url: 'https://example.com/page' })
    expect(entries[1]).toEqual({ domain: 'foo.com', title: 'https://www.foo.com', url: 'https://www.foo.com' })
  })
  test('skips entries without url', () => {
    expect(extractSources([{ title: 'no url' }, {}])).toEqual([])
  })
})
describe('validateRedirectTo', () => {
  const ctx = { allowedOrigins: new Set(['https://app.example.com']), primarySite: 'https://app.example.com' }
  test('throws on non-string', () => {
    expect(() => validateRedirectTo({ ...ctx, redirectTo: 42 })).toThrow('Expected string')
  })
  test('throws on protocol-relative', () => {
    expect(() => validateRedirectTo({ ...ctx, redirectTo: '//evil.com/foo' })).toThrow('protocol-relative')
  })
  test('throws on encoded traversal', () => {
    expect(() => validateRedirectTo({ ...ctx, redirectTo: '/foo%2f%2fevil' })).toThrow('disallowed encoded chars')
    expect(() => validateRedirectTo({ ...ctx, redirectTo: '/bar%09next' })).toThrow('disallowed encoded chars')
    expect(() => validateRedirectTo({ ...ctx, redirectTo: '/baz%5cqux' })).toThrow('disallowed encoded chars')
  })
  test('absolute path resolves to primarySite', () => {
    expect(validateRedirectTo({ ...ctx, redirectTo: '/dashboard' })).toBe('https://app.example.com/dashboard')
  })
  test('throws on malformed primarySite for absolute path', () => {
    expect(() => validateRedirectTo({ allowedOrigins: new Set(), primarySite: 'not a url', redirectTo: '/foo' })).toThrow()
  })
  test('full URL with allowed origin returns canonicalized', () => {
    expect(validateRedirectTo({ ...ctx, redirectTo: 'https://app.example.com/page?x=1' })).toBe(
      'https://app.example.com/page?x=1'
    )
  })
  test('full URL with disallowed origin throws', () => {
    expect(() => validateRedirectTo({ ...ctx, redirectTo: 'https://evil.com/page' })).toThrow('not allowed')
  })
  test('malformed full URL throws', () => {
    expect(() => validateRedirectTo({ ...ctx, redirectTo: 'http://[' })).toThrow('Invalid')
  })
})
