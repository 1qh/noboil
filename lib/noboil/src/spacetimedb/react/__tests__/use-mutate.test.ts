import { describe, expect, test } from 'bun:test'
import { defaultOnError } from '../use-mutate'

describe('stdb defaultOnError', () => {
  test('handles NOT_AUTHENTICATED', () => {
    expect(() => defaultOnError(new Error('NOT_AUTHENTICATED: missing'))).not.toThrow()
  })
  test('handles RATE_LIMITED with retryAfter', () => {
    const err = Object.assign(new Error('RATE_LIMITED'), {
      data: { code: 'RATE_LIMITED', retryAfter: 30_000 }
    })
    expect(() => defaultOnError(err)).not.toThrow()
  })
  test('handles VALIDATION_FAILED with fieldErrors', () => {
    const err = Object.assign(new Error('VALIDATION_FAILED'), {
      data: { code: 'VALIDATION_FAILED', fieldErrors: { name: 'required' } }
    })
    expect(() => defaultOnError(err)).not.toThrow()
  })
  test('handles plain error', () => {
    expect(() => defaultOnError(new Error('boom'))).not.toThrow()
  })
})
