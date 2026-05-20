import { GlobalRegistrator } from '@happy-dom/global-registrator'

if (typeof document === 'undefined') GlobalRegistrator.register()
const { describe, expect, test } = await import('bun:test')
const { arrayBufferToBase64, base64ToBytes, downloadBlob } = await import('../binary')
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
describe('downloadBlob', () => {
  test('creates anchor + clicks + revokes URL', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const origCreate = URL.createObjectURL
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const origRevoke = URL.revokeObjectURL
    let revoked = ''
    URL.createObjectURL = () => 'blob:mock'
    URL.revokeObjectURL = (u: string) => {
      revoked = u
    }
    try {
      const blob = new Blob(['hi'], { type: 'text/plain' })
      downloadBlob('out.txt', blob)
      expect(revoked).toBe('blob:mock')
    } finally {
      URL.createObjectURL = origCreate
      URL.revokeObjectURL = origRevoke
    }
  })
})
