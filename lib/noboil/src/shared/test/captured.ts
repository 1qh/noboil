/* eslint-disable no-console -- capturing console.log is this helper's whole job */
/** Runs `fn` with console.log captured, returning what it printed alongside its result. Silencing a command and asserting nothing leaves the test unable to tell a working --help from one that prints nothing at all — the output IS the behaviour under test, so it comes back rather than being thrown away. */
const captured = <T>(fn: () => T): { out: string; result: T } => {
  const lines: string[] = []
  const orig = console.log
  console.log = (...args: unknown[]) => {
    lines.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
  }
  try {
    const result = fn()
    return { out: lines.join('\n'), result }
  } finally {
    console.log = orig
  }
}
/** Async twin of `captured`: awaits `fn` before restoring console.log, so output printed after the first await is still recorded. */
const capturedAsync = async <T>(fn: () => Promise<T>): Promise<{ out: string; result: T }> => {
  const lines: string[] = []
  const orig = console.log
  console.log = (...args: unknown[]) => {
    lines.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
  }
  try {
    const result = await fn()
    return { out: lines.join('\n'), result }
  } finally {
    console.log = orig
  }
}
export { captured, capturedAsync }
