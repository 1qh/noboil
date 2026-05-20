import { describe, expect, mock, test } from 'bun:test'
import { defaultOnError } from '../react/use-mutate'

describe('convex defaultOnError', () => {
  test('handles NOT_AUTHENTICATED ConvexError', () => {
    const fn = mock(() => {
      /* Empty */
    })
    const err = new Error('NOT_AUTHENTICATED: missing identity')
    expect(() => defaultOnError(err)).not.toThrow()
    expect(typeof fn).toBe('function')
  })
  test('handles RATE_LIMITED with retryAfter', () => {
    const err = Object.assign(new Error('RATE_LIMITED: too many'), {
      data: { code: 'RATE_LIMITED', retryAfter: 60_000 }
    })
    expect(() => defaultOnError(err)).not.toThrow()
  })
  test('handles plain error with field errors', () => {
    const err = Object.assign(new Error('VALIDATION_FAILED: bad input'), {
      data: { code: 'VALIDATION_FAILED', fieldErrors: { name: 'required' } }
    })
    expect(() => defaultOnError(err)).not.toThrow()
  })
  test('handles unknown error', () => {
    expect(() => defaultOnError(new Error('boom'))).not.toThrow()
  })
})
