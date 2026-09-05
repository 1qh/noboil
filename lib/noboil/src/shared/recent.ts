/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
import { file, write } from 'bun'
import { homedir } from 'node:os'
import { join } from 'node:path'

interface RecentEntry {
  args: string[]
  at: number
  cmd: string
}
const RECENT_PATH = () => join(homedir(), '.noboil', 'recent.json')
const MAX = 20
/** Read the user's recent-command history from `~/.noboil/recent.json`. Returns `[]` on missing/malformed. */
const readRecent = async (): Promise<RecentEntry[]> => {
  try {
    const f = file(RECENT_PATH())
    if (await f.exists()) return (await f.json()) as RecentEntry[]
  } catch {
    return []
  }
  return []
}
/** Append a `(cmd, args)` invocation to recent history, dedupe + cap at MAX. Errors swallowed. */
const pushRecent = async (cmd: string, args: string[]): Promise<void> => {
  const list = await readRecent()
  const entry = { args, at: Date.now(), cmd }
  const deduped = [entry, ...list.filter(e => !(e.cmd === cmd && e.args.join(' ') === args.join(' ')))].slice(0, MAX)
  await write(RECENT_PATH(), `${JSON.stringify(deduped, null, 2)}\n`).catch(() => null)
}
export type { RecentEntry }
export { pushRecent, readRecent }
