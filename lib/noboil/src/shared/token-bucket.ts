interface BucketConfig {
  limit: number
  windowMs: number
}
interface BucketDecision {
  allowed: boolean
  next: BucketState
}
interface BucketState {
  refilledAt: number
  tokens: number
}
/** Pure: top up a token bucket given its previous state and elapsed wall time. Saturates at `cfg.limit`. */
const refill = (state: BucketState | null, cfg: BucketConfig, now: number): BucketState => {
  if (state === null) return { refilledAt: now, tokens: cfg.limit }
  const elapsedMs = Math.max(0, now - state.refilledAt)
  const refillRatePerMs = cfg.limit / cfg.windowMs
  const refilled = Math.min(cfg.limit, state.tokens + elapsedMs * refillRatePerMs)
  return { refilledAt: now, tokens: refilled }
}
/** Pure: refill + try to consume one token. Returns `{ allowed, next }` — caller persists `next` if allowed. */
const consume = (state: BucketState | null, cfg: BucketConfig, now: number): BucketDecision => {
  const r = refill(state, cfg, now)
  if (r.tokens < 1) return { allowed: false, next: r }
  return { allowed: true, next: { refilledAt: now, tokens: r.tokens - 1 } }
}
export type { BucketConfig, BucketDecision, BucketState }
export { consume, refill }
