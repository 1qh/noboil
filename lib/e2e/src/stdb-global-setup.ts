/* eslint-disable no-console */
import { rmSync } from 'node:fs'
import { join } from 'node:path'

const globalSetup = (config: { rootDir?: string } = {}) => {
  const tokenFile = join(config.rootDir ?? process.cwd(), 'e2e', '.stdb-test-token.json')
  // oxlint-disable-next-line node/no-sync
  rmSync(tokenFile, { force: true })
  console.log('SpacetimeDB E2E setup: cleared cached test token')
}
export default globalSetup
