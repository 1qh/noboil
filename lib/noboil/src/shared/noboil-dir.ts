import { homedir } from 'node:os'
import { join } from 'node:path'
/** The one home for `~/.noboil`. Three modules each rebuilt this path and only one of them carried the override, so a test could redirect the update cache while the crash log and the state file still wrote — and deleted — the developer's real files. */
// biome-ignore lint/style/noProcessEnv: the state dir is deliberately configurable
const noboilRoot = (): string => process.env.NOBOIL_CACHE_DIR ?? homedir()
const noboilPath = (...parts: string[]): string => join(noboilRoot(), '.noboil', ...parts)
export { noboilPath, noboilRoot }
