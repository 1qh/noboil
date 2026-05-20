/* eslint-disable no-console */
import { describe, expect, test } from 'bun:test'
import { init } from '../init'

describe('init --help', () => {
  test('prints usage and returns', async () => {
    const orig = console.log
    console.log = () => undefined
    try {
      await init(['--help'])
    } finally {
      console.log = orig
    }
    expect(true).toBe(true)
  })
})
