type LogLevel = 'debug' | 'error' | 'info' | 'warn'
type LogSink = (line: string, level: LogLevel) => void
const defaultSink: LogSink = (line, level) => {
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line)
    return
  }
  // eslint-disable-next-line no-console
  console.log(line)
}
let sink: LogSink = defaultSink
/**
 * Override the structured-log sink (default `console.log`). Pass `null` to restore default.
 * Use to ship logs to a remote service or capture them in tests.
 */
const setLogSink = (s: LogSink | null): void => {
  sink = s ?? defaultSink
}
/**
 * Emit a single structured-JSON log line `{ event, level, ts, ...fields }`. Cheap and
 * synchronous. Use everywhere instead of bare `console.log` so logs stay machine-parseable.
 */
const log = (level: LogLevel, event: string, fields: Record<string, unknown> = {}): void => {
  const line = JSON.stringify({ event, level, ts: Date.now(), ...fields })
  sink(line, level)
}
export type { LogLevel, LogSink }
export { log, setLogSink }
