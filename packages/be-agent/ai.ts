/** biome-ignore-all lint/style/noProcessEnv: env detection */
import type { LanguageModel } from 'ai'

import './env'
import { mockModel } from './models.mock'
const isTestEnvironment =
  typeof process !== 'undefined' &&
  Boolean(process.env.PLAYWRIGHT ?? process.env.TEST_MODE ?? process.env.CONVEX_TEST_MODE)

let cached: LanguageModel | undefined

const getModel = async (): Promise<LanguageModel> => {
  if (cached) return cached
  if (isTestEnvironment) {
    cached = mockModel
    return mockModel
  }
  const { createVertex } = await import('@ai-sdk/google-vertex'),
    vertex = createVertex({ apiKey: process.env.GOOGLE_VERTEX_API_KEY }),
    model = vertex('gemini-2.5-flash') as LanguageModel
  // eslint-disable-next-line require-atomic-updates
  cached = model
  return model
}

export { getModel }
