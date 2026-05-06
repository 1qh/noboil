/** Default port and URIs for a fresh stdb scaffold. Consumers can override via env vars. */
const DEFAULT_PORT = 4000
const DEFAULT_HTTP_URI = `http://localhost:${DEFAULT_PORT}`
const DEFAULT_WS_URI = `ws://localhost:${DEFAULT_PORT}`
export { DEFAULT_HTTP_URI, DEFAULT_PORT, DEFAULT_WS_URI }
