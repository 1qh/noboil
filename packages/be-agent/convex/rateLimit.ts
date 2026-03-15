import { defineRateLimits } from 'convex-helpers/server/rateLimit'

const RATE_LIMITS = {
    delegation: { kind: 'token bucket' as const, period: 60_000, rate: 10 },
    mcpCall: { kind: 'token bucket' as const, period: 60_000, rate: 20 },
    searchCall: { kind: 'token bucket' as const, period: 60_000, rate: 30 },
    submitMessage: { kind: 'token bucket' as const, period: 60_000, rate: 20 }
  },
  { checkRateLimit, rateLimit, resetRateLimit } = defineRateLimits(RATE_LIMITS)

export { checkRateLimit, rateLimit, resetRateLimit }
