/** Default port and URIs for a fresh stdb scaffold. Consumers can override via env vars. */
const DEFAULT_PORT = 4000
const DEFAULT_HTTP_URI = `http://localhost:${DEFAULT_PORT}`
const DEFAULT_WS_URI = `ws://localhost:${DEFAULT_PORT}`
const DEFAULT_TOKEN_KEY = 'spacetimedb.token'
const TOKEN_COOKIE_KEY = 'spacetimedb_token'
const wsToHttp = (uri: string): string => {
  if (uri.startsWith('wss://')) return `https://${uri.slice('wss://'.length)}`
  if (uri.startsWith('ws://')) return `http://${uri.slice('ws://'.length)}`
  return uri
}
export { DEFAULT_HTTP_URI, DEFAULT_PORT, DEFAULT_TOKEN_KEY, DEFAULT_WS_URI, TOKEN_COOKIE_KEY, wsToHttp }
