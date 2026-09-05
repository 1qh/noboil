/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: test fixtures construct and assert partial, invalid, or runtime-shaped values to exercise edge cases */
import { describe, expect, test } from 'bun:test'
import { arg, createBuilder, createStepSink, makeFail } from '../tools/builder'

describe('arg helpers', () => {
  test('arg.string with all fields', () => {
    const s = arg.string({
      aliases: ['n'],
      description: 'n',
      maxLength: 10,
      minLength: 1,
      optional: true,
      pattern: '^a'
    })
    expect(s.required).toBe(false)
    expect(s.optional).toBe(true)
    expect(s.maxLength).toBe(10)
    expect(s.aliases).toEqual(['n'])
  })
  test('arg.number defaults to required when optional omitted', () => {
    const n = arg.number({ description: 'n', integer: true, max: 10, min: 0 })
    expect(n.required).toBe(true)
    expect(n.integer).toBe(true)
  })
  test('arg.bool', () => {
    const b = arg.bool({ description: 'b' })
    expect(b.required).toBe(true)
  })
  test('arg.enum produces a union validator', () => {
    const e = arg.enum(['a', 'b'] as const, { description: 'e', optional: true })
    expect(e.optional).toBe(true)
    expect(e.required).toBe(false)
    expect(e.v).toBeDefined()
  })
})
describe('makeFail', () => {
  test('throws ToolError with code; .codes preserved', () => {
    const fail = makeFail('A', 'B', 'C')
    expect(fail.codes).toEqual(['A', 'B', 'C'])
    expect(() => fail('A', 'msg')).toThrow('msg')
  })
})
describe('createStepSink', () => {
  test('step + mergeSteps record entries', () => {
    const s = createStepSink()
    s.step('first')
    s.step('second', { k: 1 })
    s.mergeSteps('child:', [{ details: undefined, name: 'inner', tsMs: 5 }])
    expect(s.steps).toHaveLength(3)
    expect(s.steps[2]?.name).toBe('child:inner')
  })
})
describe('createBuilder defineTool/defineQuery/defineMutation', () => {
  interface StoredFn {
    args: unknown
    handler: (ctx: unknown, raw: unknown) => Promise<unknown>
  }
  const stored: StoredFn[] = []
  const stub = () => (def: { args: unknown; handler: (ctx: unknown, raw: unknown) => Promise<unknown> }) => {
    stored.push(def)
    return def
  }
  const deps = {
    authValidator: { isOptional: 'required', kind: 'string' } as never,
    cached: async ({ compute }: { compute: () => Promise<unknown> }) => compute(),
    internalAction: stub(),
    internalMutation: stub(),
    internalQuery: stub()
  }
  const b = createBuilder(deps as never)
  test('defineTool wraps handler; cached path runs compute', async () => {
    stored.length = 0
    const tool = b.defineTool({
      args: { name: arg.string({ description: 'n' }) },
      description: 'd',
      errorCodes: ['E'] as const,
      handler: async (ctx, args) => {
        ctx.step('working', { name: args.name })
        const v = await ctx.cached({ name: args.name }, async () => `cached:${args.name}`)
        return { name: args.name, v }
      }
    })
    expect(stored).toHaveLength(1)
    const result = (await stored[0]?.handler(
      {},
      {
        authCtx: 'auth',
        name: 'x',
        pathCtx: 'p',
        traceCtx: 'tr'
      }
    )) as { ok: boolean; result: { v: string } }
    expect(result.ok).toBe(true)
    expect(result.result.v).toBe('cached:x')
    expect((tool as { meta: { errorCodes: readonly string[] } }).meta.errorCodes).toEqual(['E'])
  })
  test('defineQuery captures errors as DispatchError', async () => {
    stored.length = 0
    b.defineQuery({
      args: {},
      handler: async () => {
        throw new Error('boom')
      }
    })
    const out = (await stored[0]?.handler(
      {},
      {
        authCtx: 'a',
        pathCtx: 'p',
        traceCtx: 't'
      }
    )) as { ok: boolean }
    expect(out.ok).toBe(false)
  })
  test('defineMutation success path', async () => {
    stored.length = 0
    b.defineMutation({
      args: {},
      handler: async () => 42
    })
    const out = (await stored[0]?.handler(
      {},
      {
        authCtx: 'a',
        pathCtx: 'p',
        traceCtx: 't'
      }
    )) as { ok: boolean; result: number }
    expect(out.ok).toBe(true)
    expect(out.result).toBe(42)
  })
  test('exclusive accepts string[] and string[][]', async () => {
    stored.length = 0
    b.defineQuery({
      args: { a: arg.string({ description: 'a' }), b: arg.string({ description: 'b' }) },
      exclusive: ['a', 'b'] as never,
      handler: async () => null
    })
    const { meta } = stored[0] as unknown as { meta: { exclusive: unknown[][] } }
    expect(meta.exclusive).toEqual([['a', 'b']])
  })
})
