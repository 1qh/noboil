/* eslint-disable no-console */
import { describe, expect, test } from 'bun:test'
import { capturedAsync } from '../shared/test'
import { init } from '../init'

describe('init --help', () => {
  test('prints usage and returns', async () => {
    const { out } = await capturedAsync(() => init(['--help']))
    expect(out).toContain('noboil init')
    expect(out).toContain('Usage:')
    expect(out).toContain('--db=convex|spacetimedb')
  })
})
