/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
const env = (k: string): string | undefined => {
  const r = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return r?.env?.[k]
}
const isPlaywright = (): boolean => env('PLAYWRIGHT') === '1' || env('NEXT_PUBLIC_PLAYWRIGHT') === '1'
const isStdbTestMode = (): boolean => isPlaywright() || env('SPACETIMEDB_TEST_MODE') === 'true'
const isCvxTestMode = (): boolean => isPlaywright() || env('CONVEX_TEST_MODE') === 'true'
export { isCvxTestMode, isPlaywright, isStdbTestMode }
