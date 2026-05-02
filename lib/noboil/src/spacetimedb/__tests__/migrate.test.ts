import { describe, expect, test } from 'bun:test'
import { diffSnapshots, isOptionalField, parseFieldsFromBlock, parseSchemaContent } from '../migrate'
describe('stdb migrate', () => {
  test('isOptionalField recognizes t.option', () => {
    expect(isOptionalField('t.option(t.string())')).toBe(true)
    expect(isOptionalField('t.string()')).toBe(false)
  })
  test('parseFieldsFromBlock recognizes array + map types', () => {
    const block = `
      tags: t.array(),
      meta: t.map(),
      weird: t.custom(),
    `
    const out = parseFieldsFromBlock(block)
    const byName = new Map(out.map(f => [f.name, f]))
    expect(byName.get('tags')?.type).toBe('array')
    expect(byName.get('meta')?.type).toBe('map')
    expect(byName.get('weird')?.type).toBe('unknown')
  })
  test('parseFieldsFromBlock detects field types', () => {
    const block = `
      id: t.u64(),
      name: t.string(),
      active: t.bool(),
      avatar: t.option(t.bytes()),
      tags: t.bytes(),
    `
    const out = parseFieldsFromBlock(block)
    const byName = new Map(out.map(f => [f.name, f]))
    expect(byName.get('id')?.type).toBe('number')
    expect(byName.get('name')?.type).toBe('string')
    expect(byName.get('active')?.type).toBe('boolean')
    expect(byName.get('avatar')?.optional).toBe(true)
    expect(byName.get('tags')?.type).toBe('bytes')
  })
  test('parseSchemaContent extracts tables sorted by name', () => {
    const src = `
      const s = schema({
        zebra: table(t.u64(), { id: t.u64() }),
        alpha: table(t.u64(), { name: t.string() }),
      })
    `
    const snap = parseSchemaContent(src)
    expect(snap.tables.map(t => t.name)).toEqual(['alpha', 'zebra'])
  })
  test('diffSnapshots reports table_added/removed and field changes', () => {
    const before = {
      tables: [
        { fields: [{ name: 'a', optional: false, type: 'string' }], name: 't1' },
        { fields: [{ name: 'b', optional: false, type: 'number' }], name: 't2' }
      ]
    }
    const after = {
      tables: [
        {
          fields: [
            { name: 'a', optional: false, type: 'number' },
            { name: 'c', optional: false, type: 'string' }
          ],
          name: 't1'
        },
        { fields: [], name: 't3' }
      ]
    }
    const actions = diffSnapshots(before, after)
    const types = new Set(actions.map(a => a.type))
    expect(types.has('table_added')).toBe(true)
    expect(types.has('table_removed')).toBe(true)
    expect(types.has('field_added_required')).toBe(true)
    expect(types.has('field_type_changed')).toBe(true)
  })
  test('diffSnapshots returns empty when snapshots match', () => {
    const snap = { tables: [{ fields: [{ name: 'a', optional: false, type: 'string' }], name: 't1' }] }
    expect(diffSnapshots(snap, snap)).toEqual([])
  })
})
