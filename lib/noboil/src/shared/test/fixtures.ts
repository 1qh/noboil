import { readJson } from '../env-file'
import { setHermeticAdapter } from './hermetic'

type FixtureMap = Record<string, unknown>
interface FixtureRule {
  match?: string
  response: unknown
}
const isRuleArray = (v: unknown): v is FixtureRule[] =>
  Array.isArray(v) && v.every(r => typeof r === 'object' && r !== null && 'response' in r)
/**
 * Wire up the hermetic adapter from a JSON fixture file: `{ op: response | rule[] }`.
 * Each rule supports `{ match: substring, response }` so a single op can return different
 * fixtures based on payload content. Use in test setup to record/replay external calls.
 */
const loadHermeticFixtures = (path: string): void => {
  const data = readJson(path) as FixtureMap
  setHermeticAdapter((op, payload) => {
    const entry = data[op]
    if (entry === undefined) return
    if (isRuleArray(entry)) {
      const s = JSON.stringify(payload)
      for (const rule of entry) if (rule.match === undefined || s.includes(rule.match)) return rule.response
      return
    }
    return entry
  })
}
export type { FixtureMap, FixtureRule }
export { loadHermeticFixtures }
