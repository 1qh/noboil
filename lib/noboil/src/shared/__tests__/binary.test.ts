import { describe, expect, test } from 'bun:test'
import { arrayBufferToBase64, base64ToBytes } from '../binary'
describe('arrayBufferToBase64', () => {
  test('encodes small buffer', () => {
    const buf = new TextEncoder().encode('hello').buffer
    expect(arrayBufferToBase64(buf)).toBe('aGVsbG8=')
  })
  test('roundtrips empty', () => {
    expect(arrayBufferToBase64(new ArrayBuffer(0))).toBe('')
  })
  test('handles buffer larger than chunk size (>8192 bytes)', () => {
    const bytes = new Uint8Array(20_000).fill(65)
    const b64 = arrayBufferToBase64(bytes.buffer)
    const back = base64ToBytes(b64)
    expect(back).toEqual(bytes)
  })
})
describe('base64ToBytes', () => {
  test('decodes a base64 string', () => {
    expect(base64ToBytes('aGVsbG8=')).toEqual(new TextEncoder().encode('hello'))
  })
  test('decodes empty', () => {
    expect(base64ToBytes('')).toEqual(new Uint8Array())
  })
})
