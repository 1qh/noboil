import { write } from 'bun'
import { noboilPath } from './noboil-dir'

const LOG_PATH = () => noboilPath('last-error.log')
/** Best-effort write of an unhandled-error stack + argv + cwd to `~/.noboil/last-error.log`. Swallows IO errors. */
const logCrash = async (error: unknown): Promise<void> => {
  const stack = error instanceof Error ? (error.stack ?? error.message) : String(error)
  const entry = `[${new Date().toISOString()}]\nargv: ${process.argv.slice(2).join(' ')}\ncwd: ${process.cwd()}\n\n${stack}\n`
  try {
    await write(LOG_PATH(), entry)
  } catch {
    // best-effort: crash logging must never throw over the original error
  }
}
export { LOG_PATH, logCrash }
