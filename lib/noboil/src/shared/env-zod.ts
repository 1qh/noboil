/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
import type { ZodObject, ZodRawShape, ZodType } from 'zod/v4'
/**
 * Strict env reader: parses `process.env` against a Zod schema once, lazily, and returns
 * a proxy with fully-typed keys. Throws on first read if any required var is missing or
 * malformed. Use for required production env vars (`DATABASE_URL`, etc.).
 */
const createEnv = <T extends ZodRawShape>(
  schema: ZodObject<T>
): { [K in keyof T]: T[K] extends ZodType<infer R> ? R : never } => {
  let cached: null | Record<string, unknown> = null
  return new Proxy(
    {},
    {
      get: (_, key: string) => {
        /** biome-ignore lint/style/noProcessEnv: intentional env access */
        cached ??= schema.parse(process.env) as Record<string, unknown>
        return cached[key]
      }
    }
  ) as { [K in keyof T]: T[K] extends ZodType<infer R> ? R : never }
}
/**
 * Lenient env reader: returns `undefined` (or supplied defaults) for missing/invalid vars
 * instead of throwing. Use for optional feature flags, dev-only overrides, anything that
 * shouldn't crash the process at startup.
 */
const createOptionalEnv = <T extends ZodRawShape>(
  schema: ZodObject<T>,
  defaults: Partial<{ [K in keyof T]: T[K] extends ZodType<infer R> ? R : never }> = {}
): { [K in keyof T]?: T[K] extends ZodType<infer R> ? R : never } => {
  const keys = new Set(Object.keys(schema.shape))
  return new Proxy(
    {},
    {
      get: (_, key: string) => {
        if (typeof key !== 'string') return
        if (!keys.has(key)) throw new Error(`env: unknown optional key '${key}'`)
        /** biome-ignore lint/style/noProcessEnv: intentional env access */
        const raw = process.env[key]
        if (raw === undefined) return (defaults as Record<string, unknown>)[key]
        const shape = (
          schema.shape as unknown as Record<
            string,
            { safeParse: (v: unknown) => { data: unknown; success: true } | { success: false } }
          >
        )[key]
        if (!shape) return raw
        const parsed = shape.safeParse(raw)
        return parsed.success ? parsed.data : (defaults as Record<string, unknown>)[key]
      }
    }
  )
}
export { createEnv, createOptionalEnv }
