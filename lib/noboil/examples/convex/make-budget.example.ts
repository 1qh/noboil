import { makeBudget } from '../../src/convex/server'
import { stubBuilders } from '../_stub'

const llmBudget = makeBudget({
  builders: stubBuilders,
  cap: 10_000,
  inflightMax: 50,
  periodMs: 24 * 60 * 60 * 1000,
  table: 'llmBudget'
})
export { llmBudget }
