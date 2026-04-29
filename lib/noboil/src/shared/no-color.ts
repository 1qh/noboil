import { env } from 'bun'
/** True when ANSI color should be suppressed: `NO_COLOR` set, `FORCE_COLOR` unset, and stdout not a TTY. */
const isNoColor = (): boolean => {
  if (env.NO_COLOR !== undefined) return true
  if (env.FORCE_COLOR !== undefined) return false
  return !process.stdout.isTTY
}
/** Pass-through `c` when color is enabled, `undefined` otherwise — for chalk-style `color('red')` props. */
const color = (c: string): string | undefined => (isNoColor() ? undefined : c)
export { color, isNoColor }
