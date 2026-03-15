/** biome-ignore-all lint/style/noProcessEnv: env detection */
import { ConvexHttpClient } from 'convex/browser'
import type { FunctionReference } from 'convex/server'
import { anyApi } from 'convex/server'
import { execSync } from 'node:child_process'

const globalSetup = async () => {
  try {
    execSync('bun with-env convex env set CONVEX_TEST_MODE true', {
      cwd: '../../packages/be-agent',
      stdio: 'pipe'
    })
  } catch (error) {
    void error
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'http://127.0.0.1:3212',
    client = new ConvexHttpClient(convexUrl)
  await client.mutation(anyApi.testauth?.ensureTestUser as FunctionReference<'mutation'>, {})
}

export default globalSetup
