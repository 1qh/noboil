import { describe, expect, test } from 'bun:test'
import { createErrorUtils } from '../server/helpers'

const throwError = (code: string, opts?: Record<string, unknown> | string): never => {
  const message = typeof opts === 'string' ? opts : JSON.stringify({ code, ...(opts as object) })
  const err = new Error(`${code}: ${message}`)
  Object.assign(err, { data: { code, ...(opts as object) } })
  throw err
}
const extractErrorData = (e: unknown) => {
  if (e && typeof e === 'object' && 'data' in e) return (e as { data: { code: string } }).data
}
const utils = createErrorUtils({
  errorMessages: { CUSTOM: 'a custom error', NOT_FOUND: 'not found' },
  extractErrorData,
  throwError
})
describe('createErrorUtils', () => {
  test('catches err and extracts code', () => {
    let caught: unknown
    try {
      utils.err('NOT_FOUND', 'detail')
    } catch (error) {
      caught = error
    }
    expect(utils.extractErrorData(caught)?.code).toBe('NOT_FOUND')
  })
  test('isErrorCode + isMutationError', () => {
    let caught: unknown
    try {
      utils.err('NOT_FOUND', 'd')
    } catch (error) {
      caught = error
    }
    expect(utils.isErrorCode(caught, 'NOT_FOUND')).toBe(true)
    expect(utils.isErrorCode(caught, 'OTHER')).toBe(false)
    expect(utils.isMutationError(caught)).toBe(true)
    expect(utils.isMutationError(new Error('plain'))).toBe(false)
  })
  test('matchError dispatches to per-code handler with _ fallback', () => {
    let caught: unknown
    try {
      utils.err('NOT_FOUND', 'd')
    } catch (error) {
      caught = error
    }
    const r1 = utils.matchError(caught, { NOT_FOUND: data => `code:${data.code}`, _: () => 'fb' })
    expect(r1).toBe('code:NOT_FOUND')
    expect(utils.matchError(new Error('plain'), { _: () => 'fb' })).toBe('fb')
    expect(utils.matchError(new Error('plain'), {})).toBeUndefined()
  })
  test('handleError dispatches handlers by code', () => {
    let saw = ''
    let caught: unknown
    try {
      utils.err('NOT_FOUND', 'd')
    } catch (error) {
      caught = error
    }
    const setSaw = () => {
      saw = 'nf'
    }
    utils.handleError(caught, { NOT_FOUND: setSaw, default: () => undefined })
    expect(saw).toBe('nf')
  })
  test('errValidation flattens zod-like error', () => {
    const fakeZodError = {
      flatten: () => ({ fieldErrors: { name: ['required'] } })
    }
    let caught: unknown
    try {
      utils.errValidation('VALIDATION_FAILED', fakeZodError)
    } catch (error) {
      caught = error
    }
    expect(utils.extractErrorData(caught)?.code).toBe('VALIDATION_FAILED')
  })
  test('fail returns standard MutationResult shape', () => {
    expect(utils.fail('CUSTOM')).toMatchObject({ error: { code: 'CUSTOM', message: 'a custom error' }, ok: false })
  })
})
