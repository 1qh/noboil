// biome-ignore-all lint/style/noProcessEnv: env validation

import { createEnv } from '@t3-oss/env-core'
import { string } from 'zod/v4'

export default createEnv({
  runtimeEnv: process.env,
  server: {
    AUTH_GOOGLE_ID: string(),
    AUTH_GOOGLE_SECRET: string(),
    AUTH_SECRET: string(),
    GOOGLE_VERTEX_API_KEY: string().min(1)
  },
  skipValidation: process.env.npm_lifecycle_event === 'lint' || Boolean(process.env.CONVEX_TEST_MODE)
})
