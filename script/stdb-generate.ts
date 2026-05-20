import { config } from '@a/config'
import { root, run, withUnpatchedStdbSdk } from './utils'

await withUnpatchedStdbSdk(async () => {
  await run(
    `bash -lc 'PATH="${root}/node_modules/.bin:$HOME/.local/bin:$PATH" spacetime generate --lang typescript --out-dir ${config.paths.backendStdb}/module_bindings --module-path ${config.paths.backendStdb}'`,
    { quiet: false }
  )
})
