/* eslint-disable no-console */
import { describe, expect, test } from 'bun:test'
import { die } from '../cli-utils'
describe('die', () => {
  test('logs to console.error then exits non-zero', () => {
    const origErr = console.error
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const origExit = process.exit
    let logged = ''
    let exitCode: number | undefined
    console.error = (m: string) => {
      logged = m
    }
    process.exit = (c?: number) => {
      exitCode = c
      throw new Error('__exit__')
    }
    try {
      try {
        die('boom')
      } catch (error) {
        if (!(error instanceof Error) || error.message !== '__exit__') throw error
      }
      expect(logged).toContain('boom')
      expect(exitCode).toBe(1)
    } finally {
      console.error = origErr
      process.exit = origExit
    }
  })
})
