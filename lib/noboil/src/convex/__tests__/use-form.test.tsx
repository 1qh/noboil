import { GlobalRegistrator } from '@happy-dom/global-registrator'
if (typeof document === 'undefined') GlobalRegistrator.register()
const { describe, expect, test } = await import('bun:test')
const { act, renderHook } = await import('@testing-library/react')
const { ConvexProvider, ConvexReactClient } = await import('convex/react')
const React = await import('react')
const { z } = await import('zod/v4')
const { useForm, useFormMutation } = await import('../react/form')
const client = new ConvexReactClient('https://example.convex.cloud')
const wrap = ({ children }: { children: React.ReactNode }) => React.createElement(ConvexProvider, { client }, children)
describe('convex react form hooks', () => {
  test('useForm returns instance with meta + watch', () => {
    const schema = z.object({ title: z.string() })
    const { result } = renderHook(
      () =>
        useForm({
          onSubmit: (d: { title: string }) => d,
          schema,
          values: { title: 'init' }
        }),
      { wrapper: wrap }
    )
    expect(result.current.meta.title.kind).toBe('string')
    expect(result.current.watch('title')).toBe('init')
  })
  test('useFormMutation symbol is exported', () => {
    expect(typeof useFormMutation).toBe('function')
  })
})
