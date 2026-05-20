/* eslint-disable no-console */
import { describe, expect, mock, test } from 'bun:test'
import { findBracketEnd, isSchemaFile, printSummary } from '../viz'

describe('findBracketEnd', () => {
  test('returns index of matching close brace', () => {
    expect(findBracketEnd('{ a }', 1)).toBe(4)
    expect(findBracketEnd('{ { } }', 1)).toBe(6)
    expect(findBracketEnd('{ a } trailing', 1)).toBe(4)
  })
  test('walks past trailing on unbalanced input', () => {
    const s = '{ unbalanced'
    expect(findBracketEnd(s, 1)).toBe(s.length - 1)
  })
})
describe('isSchemaFile', () => {
  test('matches when any marker is present', () => {
    expect(isSchemaFile('foo makeOwned( bar', ['makeOwned(', 'child('])).toBe(true)
    expect(isSchemaFile('hello', ['x', 'y'])).toBe(false)
    expect(isSchemaFile('', ['marker'])).toBe(false)
  })
})
describe('printSummary', () => {
  test('emits one console.log per row + blank lines', () => {
    const orig = console.log
    const log = mock(() => {
      /* Empty */
    })
    console.log = log as never
    try {
      printSummary(
        [{ fields: [{ name: 'id', type: 'string' }], name: 'todo', tableType: 'owned' }],
        [
          {
            fields: [{ name: 'msg', type: 'string' }],
            foreignKey: 'todoId',
            name: 'comment',
            parent: 'todo',
            tableType: 'child'
          }
        ]
      )
    } finally {
      console.log = orig
    }
    expect(log).toHaveBeenCalled()
  })
})
