import type { Page } from '@playwright/test'
import { DEFAULT_TOKEN_KEY, TOKEN_COOKIE_KEY } from 'noboil/spacetimedb'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { STDB_HTTP_URL, STDB_MODULE } from './stdb-env'

let cachedToken: null | { identity: string; token: string } = null
const ensureToken = async (tokenFile: string): Promise<{ identity: string; token: string }> => {
  if (cachedToken) return cachedToken
  const response = await fetch(`${STDB_HTTP_URL}/v1/identity`, {
    method: 'POST'
  })
  const data = (await response.json()) as { identity: string; token: string }
  // oxlint-disable-next-line node/no-sync
  writeFileSync(tokenFile, JSON.stringify(data))
  cachedToken = data
  return data
}
const createStdbLogin = (dir: string) => {
  const tokenFile = join(dir, '.stdb-test-token.json')
  const login = async (page?: Page): Promise<void> => {
    if (!page) return
    const data = await ensureToken(tokenFile)
    await page.context().clearCookies()
    await page.context().addCookies([
      {
        domain: 'localhost',
        name: TOKEN_COOKIE_KEY,
        path: '/',
        value: encodeURIComponent(data.token)
      }
    ])
    await page.addInitScript(
      ({ k, t }) => {
        const g = globalThis as Record<string, unknown>
        g.PLAYWRIGHT = '1'
        globalThis.localStorage.clear()
        globalThis.localStorage.setItem(k, t)
      },
      { k: DEFAULT_TOKEN_KEY, t: data.token }
    )
    const currentUrl = page.url()
    if (currentUrl !== 'about:blank' && !currentUrl.startsWith('chrome'))
      await page.evaluate(
        ({ k, t }) => {
          globalThis.localStorage.clear()
          globalThis.localStorage.setItem(k, t)
        },
        { k: DEFAULT_TOKEN_KEY, t: data.token }
      )
  }
  const cleanupTestData = async () => {
    const data = await ensureToken(tokenFile)
    await fetch(`${STDB_HTTP_URL}/v1/database/${STDB_MODULE}/call/cleanup_test_data`, {
      body: JSON.stringify([]),
      headers: {
        Authorization: `Bearer ${data.token}`,
        'Content-Type': 'application/json'
      },
      method: 'POST'
    })
  }
  return { cleanupTestData, login }
}
export { createStdbLogin }
