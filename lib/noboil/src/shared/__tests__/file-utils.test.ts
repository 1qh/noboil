import { describe, expect, test } from 'bun:test'
import { fileLabel, fmt, isImgType, isImgUrl, parseAccept } from '../components/file-utils'
describe('fmt', () => {
  test('bytes < 1KB show as B', () => {
    expect(fmt(0)).toBe('0 B')
    expect(fmt(1023)).toBe('1023 B')
  })
  test('bytes 1KB to 1MB show as KB', () => {
    expect(fmt(1024)).toBe('1.0 KB')
    expect(fmt(1024 * 1024 - 1)).toContain('KB')
  })
  test('bytes >= 1MB show as MB', () => {
    expect(fmt(1024 * 1024)).toBe('1.0 MB')
    expect(fmt(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
describe('isImgType', () => {
  test('image/* prefix', () => {
    expect(isImgType('image/png')).toBe(true)
    expect(isImgType('image/jpeg')).toBe(true)
    expect(isImgType('text/plain')).toBe(false)
    expect(isImgType('')).toBe(false)
  })
})
describe('isImgUrl', () => {
  test('data: image and blob: are images', () => {
    expect(isImgUrl('data:image/png;base64,...')).toBe(true)
    expect(isImgUrl('blob:http://x/123')).toBe(true)
  })
  test('common image extensions are detected', () => {
    expect(isImgUrl('https://x/foo.png')).toBe(true)
    expect(isImgUrl('https://x/foo.JPG?v=1')).toBe(true)
    expect(isImgUrl('https://x/y.webp')).toBe(true)
    expect(isImgUrl('https://x/y.avif')).toBe(true)
  })
  test('non-image URL → false', () => {
    expect(isImgUrl('https://x/foo.pdf')).toBe(false)
    expect(isImgUrl('https://x/page.html')).toBe(false)
  })
})
describe('fileLabel', () => {
  test('returns last path segment URL-decoded', () => {
    expect(fileLabel('https://x/path/to/file%20name.png')).toBe('file name.png')
  })
  test('falls back to File when path empty', () => {
    expect(fileLabel('https://x/')).toBe('File')
  })
  test('returns File on malformed URL', () => {
    expect(fileLabel('not-a-url')).toBe('File')
  })
})
describe('parseAccept', () => {
  test('undefined input → undefined', () => {
    expect(parseAccept()).toBeUndefined()
  })
  test('comma-list → record with empty arrays', () => {
    expect(parseAccept('image/png, image/jpeg')).toEqual({ 'image/jpeg': [], 'image/png': [] })
  })
})
