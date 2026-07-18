import { describe, expect, test } from 'bun:test'
import { init } from '../init'
import { capturedAsync } from '../shared/test'

describe('init --help', () => {
  test('prints usage and returns', async () => {
    const { out } = await capturedAsync(async () => init(['--help']))
    expect(out).toContain('noboil init')
    expect(out).toContain('Usage:')
    expect(out).toContain('--db=convex|spacetimedb')
  })
})
