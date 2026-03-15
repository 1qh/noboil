import { getAuthUserId } from '@convex-dev/auth/server'
import { makeTestAuth } from '@noboil/convex/test'

import { mutation, query } from './_generated/server'

const testAuth = makeTestAuth({
    getAuthUserId: getAuthUserId as (ctx: unknown) => Promise<null | string>,
    mutation,
    query
  }),
  { createTestUser, ensureTestUser, getAuthUserIdOrTest, isTestMode, TEST_EMAIL } = testAuth

export { createTestUser, ensureTestUser, getAuthUserIdOrTest, isTestMode, TEST_EMAIL }
