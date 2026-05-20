import { describe, expect, test } from 'bun:test'
import { array, boolean, date, number, object, string } from 'zod/v4'
import { buildMeta, getMax, getMeta, hasShapeKey, readRegistryMeta, resolveFormToast } from '../react/form'

const file = () => string().meta({ nb: 'file' as const })
const files = () => array(file()).meta({ nb: 'files' as const })
describe('getMeta', () => {
  test('string field → kind: string', () => {
    expect(getMeta(string())).toEqual({ kind: 'string' })
  })
  test('number field → kind: number', () => {
    expect(getMeta(number())).toEqual({ kind: 'number' })
  })
  test('boolean field → kind: boolean', () => {
    expect(getMeta(boolean())).toEqual({ kind: 'boolean' })
  })
  test('date field → kind: date', () => {
    expect(getMeta(date())).toEqual({ kind: 'date' })
  })
  test('array(string) → kind: stringArray', () => {
    expect(getMeta(array(string())).kind).toBe('stringArray')
  })
  test('array(number) → kind: unknown', () => {
    expect(getMeta(array(number())).kind).toBe('unknown')
  })
  test('file() → kind: file', () => {
    expect(getMeta(file()).kind).toBe('file')
  })
  test('files() → kind: files', () => {
    expect(getMeta(files()).kind).toBe('files')
  })
})
describe('buildMeta', () => {
  test('returns FieldMeta keyed by shape key', () => {
    const schema = object({
      done: boolean(),
      tags: array(string()),
      title: string()
    })
    const meta = buildMeta(schema)
    expect(meta.title.kind).toBe('string')
    expect(meta.done.kind).toBe('boolean')
    expect(meta.tags.kind).toBe('stringArray')
  })
})
describe('getMax', () => {
  test('reads max length from string schema', () => {
    expect(getMax(string().max(120))).toBe(120)
  })
  test('returns undefined when schema has no max', () => {
    expect(getMax(string())).toBeUndefined()
    expect(getMax(undefined)).toBeUndefined()
  })
})
describe('hasShapeKey', () => {
  test('true when key present, false otherwise', () => {
    const { shape } = object({ name: string() })
    expect(hasShapeKey(shape, 'name')).toBe(true)
    expect(hasShapeKey(shape, 'absent')).toBe(false)
  })
})
describe('readRegistryMeta', () => {
  test('non-zod input returns empty object', () => {
    expect(readRegistryMeta(null)).toEqual({})
    expect(readRegistryMeta('plain')).toEqual({})
    expect(readRegistryMeta({})).toEqual({})
  })
  test('zod schema with .meta() title/description/max passes through', () => {
    const s = string().meta({ description: 'desc', max: 5, title: 'T' })
    const r = readRegistryMeta(s)
    expect(r.title).toBe('T')
    expect(r.description).toBe('desc')
    expect(r.max).toBe(5)
  })
  test('zod schema with maxLength/maxItems falls through', () => {
    const s = string().meta({ maxLength: 10 })
    expect(readRegistryMeta(s).max).toBe(10)
    const s2 = array(string()).meta({ maxItems: 7 })
    expect(readRegistryMeta(s2).max).toBe(7)
  })
})
describe('resolveFormToast', () => {
  test('returns onSuccess when no toast.success', () => {
    let cb = 0
    const r = resolveFormToast({
      onSuccess: () => {
        cb += 1
      }
    })
    r.success?.()
    expect(cb).toBe(1)
  })
  test('toast.success wraps onSuccess and triggers toast', () => {
    let cb = 0
    const r = resolveFormToast({
      onSuccess: () => {
        cb += 1
      },
      toast: { success: 'saved!' }
    })
    r.success?.()
    expect(cb).toBe(1)
  })
  test('onError takes precedence over toast.error; toast.error builds default', () => {
    const handler = () => undefined
    const r1 = resolveFormToast({ onError: handler })
    expect(r1.error).toBe(handler)
    const r2 = resolveFormToast({ toast: { error: 'failed!' } })
    expect(typeof r2.error).toBe('function')
  })
  test('returns undefined success and undefined error when neither set', () => {
    const r = resolveFormToast({})
    expect(r.success).toBeUndefined()
    expect(r.error).toBeUndefined()
  })
})
