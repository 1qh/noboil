const DEFAULT_MAX_HTTP_BODY = 2_000_000
/** Build a `{ error }` JSON Response with the given status — handy shorthand in HTTP handlers. */
const jsonErr = (error: string, status: number): Response => Response.json({ error }, { status })
/**
 * Parse a JSON request body with size + content-type guards. Returns the parsed value on
 * success, or a `Response` (4xx) on failure — caller can `if (result instanceof Response)
 * return result`. Cap defaults to 2MB.
 */
const parseHttpBody = async (req: Request, max: number = DEFAULT_MAX_HTTP_BODY): Promise<unknown> => {
  const ct = req.headers.get('Content-Type') ?? ''
  if (!ct.includes('application/json')) return jsonErr('Content-Type must be application/json', 400)
  const cl = req.headers.get('content-length')
  if (cl && Number(cl) > max) return jsonErr('body too large', 413)
  const text = await req.text()
  if (text.length > max) return jsonErr('body too large', 413)
  try {
    return JSON.parse(text) as unknown
  } catch {
    return jsonErr('invalid JSON body', 400)
  }
}
export { DEFAULT_MAX_HTTP_BODY, jsonErr, parseHttpBody }
