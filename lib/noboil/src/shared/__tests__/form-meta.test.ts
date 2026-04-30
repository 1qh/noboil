import { describe, expect, test } from 'bun:test'
import { array, boolean, date, number, object, string } from 'zod/v4'
import { buildMeta, getMeta } from '../react/form'
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
