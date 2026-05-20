/** biome-ignore-all lint/style/noProcessEnv: env detection in test teardown */
/* eslint-disable no-console */
import { config } from '@a/config'
import { $ } from 'bun'
import { join, resolve } from 'node:path'

const BACKEND_CWD = join(resolve(import.meta.dirname, '../../..'), config.paths.backendConvex)
const globalTeardown = async () => {
  if (process.env.SKIP_CONVEX_ENV_TOGGLE) return
  try {
    await $`nb-env convex env remove CONVEX_TEST_MODE`.cwd(BACKEND_CWD).quiet()
    console.log('CONVEX_TEST_MODE disabled on server')
  } catch {
    console.log('CONVEX_TEST_MODE was not set (already clean)')
  }
}
export default globalTeardown
