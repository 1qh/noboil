/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
/** Backend-agnostic e2e helpers. Wires `expectError` against any error-code extractor. */
const makeExpectError =
  (extract: (e: unknown) => null | { code: string }) =>
  async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn()
    } catch (error) {
      const r = extract(error)
      if (r) return r as T
      throw error
    }
  }
export { makeExpectError }
