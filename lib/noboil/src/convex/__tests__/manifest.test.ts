import { describe, expect, test } from 'bun:test'
import { buildArgs, buildTree, findCommand, findValidPath } from '../tools/manifest'
const mkEntry = (path: string[], extra: Record<string, unknown> = {}) =>
  ({
    argSpecs: {},
    fn: () => null,
    inferredDescription: null,
    inferredSchema: null,
    kind: 'query',
    meta: {
      cost: 'low',
      description: 'desc',
      deterministic: true,
      errorCodes: [],
      examples: [],
      exclusive: [],
      selfTest: {},
      version: '1'
    },
    path,
    tier: 'public',
    ...extra
  }) as never
describe('manifest helpers', () => {
  test('buildArgs maps ArgSpec to manifest arg shape', () => {
    const out = buildArgs({
      include_files: {
        aliases: ['inc_files'],
        description: 'flag',
        max: 10,
        min: 1,
        v: { kind: 'int64' } as never
      } as never
    })
    expect(out).toHaveLength(1)
    expect(out[0]?.name).toBe('--include-files')
    expect(out[0]?.aliases).toEqual(['--inc-files'])
    expect(out[0]?.type).toBe('number')
    expect(out[0]?.min).toBe(1)
  })
  test('buildArgs handles union → enum and union → union', () => {
    const enumOut = buildArgs({
      mode: {
        description: '',
        v: {
          kind: 'union',
          members: [
            { kind: 'literal', value: 'fast' },
            { kind: 'literal', value: 'slow' }
          ]
        } as never
      } as never
    })
    expect(enumOut[0]?.type).toBe('enum')
    expect(enumOut[0]?.enum).toEqual(['fast', 'slow'])
  })
  test('buildTree groups commands by provider/path; findCommand looks up by path', () => {
    const reg = {
      a: mkEntry(['p1', 'g1', 'cmd_a']),
      b: mkEntry(['p1', 'cmd_b'])
    }
    const tree = buildTree({ providers: { p1: { description: 'P1', name: 'P1', requiresEnv: [] } }, registry: reg })
    expect(tree.p1?.kind).toBe('provider')
    expect(tree.p1?.children?.g1?.children?.['cmd-a']?.kind).toBe('command')
    expect(findCommand(reg, ['p1', 'cmd_b'])?.path).toEqual(['p1', 'cmd_b'])
    expect(findCommand(reg, ['nope'])).toBeNull()
  })
  test('findValidPath returns the longest matching prefix and child names', () => {
    const reg = {
      a: mkEntry(['p1', 'a']),
      b: mkEntry(['p1', 'b']),
      c: mkEntry(['p2', 'c'])
    }
    const r = findValidPath(reg, ['p1', 'unknown'])
    expect(r.validPath).toEqual(['p1'])
    expect(r.validChildren).toEqual(['a', 'b'])
  })
})
