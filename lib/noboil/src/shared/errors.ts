/**
 * Best-effort error → string. Unwraps `Error.message`, `ConvexError.data`, falls back
 * to `String(e)`. Use anywhere you'd otherwise write `e instanceof Error ? e.message : String(e)`.
 */
const errorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null && 'data' in e) return String(e.data)
  return String(e)
}
export { errorMessage }
