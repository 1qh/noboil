/* eslint-disable no-console */
/** biome-ignore-all lint/style/noProcessEnv: env detection in test setup */
/* eslint-disable no-await-in-loop */
import type { FunctionReference } from 'convex/server'
import { config } from '@a/config'
import { $, file } from 'bun'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import { parseEnvLine } from 'noboil/env-file'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')
const BACKEND_CWD = join(REPO_ROOT, config.paths.backendConvex)
const loadRootEnv = async () => {
  const envPath = join(REPO_ROOT, '.env')
  if (!existsSync(envPath)) return
  const text = await file(envPath).text()
  for (const line of text.split('\n')) {
    const parsed = parseEnvLine(line)
    if (parsed && !process.env[parsed[0]]) process.env[parsed[0]] = parsed[1]
  }
}
interface CleanupResult {
  count: number
  done: boolean
}
const setConvexTestMode = async (enabled: boolean) => {
  const action = enabled ? 'set' : 'remove'
  const args = enabled ? ['CONVEX_TEST_MODE', 'true'] : ['CONVEX_TEST_MODE']
  try {
    await $`nb-env convex env ${action} ${args}`.cwd(BACKEND_CWD).quiet()
    console.log(`CONVEX_TEST_MODE ${enabled ? 'enabled' : 'disabled'} on server`)
  } catch (error) {
    if (enabled) throw new Error('Failed to set CONVEX_TEST_MODE on Convex server', { cause: error })
  }
}
const cleanup = async (client: ConvexHttpClient): Promise<CleanupResult> =>
  client.mutation(anyApi.testauth?.cleanupTestData as FunctionReference<'mutation'>, {}) as Promise<CleanupResult>
const globalSetup = async () => {
  await loadRootEnv()
  if (!process.env.SKIP_CONVEX_ENV_TOGGLE) await setConvexTestMode(true)
  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? ''
  if (!convexUrl) throw new Error('CONVEX_URL or NEXT_PUBLIC_CONVEX_URL not set')
  const client = new ConvexHttpClient(convexUrl)
  await client.mutation(anyApi.testauth?.ensureTestUser as FunctionReference<'mutation'>, {})
  let result = await cleanup(client)
  while (!result.done) {
    console.log(`Cleaned up ${result.count} test records, continuing...`)
    /** biome-ignore lint/performance/noAwaitInLoops: sequential cleanup required */
    result = await cleanup(client)
  }
  console.log('Test data cleanup complete')
}
export default globalSetup
