/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
import { createRequire } from 'node:module'
import type { ImagePipeline } from './image'

type SharpFactory = (input: Buffer) => ImagePipeline
const require = createRequire(import.meta.url)
const isSharpFactory = (value: unknown): value is SharpFactory => typeof value === 'function'
const loadSharp = (): SharpFactory => {
  const mod = require('sharp') as unknown
  if (isSharpFactory(mod)) return mod
  if (typeof mod === 'object' && mod !== null) {
    const value = (mod as { readonly default?: unknown }).default
    if (isSharpFactory(value)) return value
  }
  throw new TypeError('sharp module did not export a callable image pipeline factory')
}
export { loadSharp }
