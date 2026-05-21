/* eslint-disable @typescript-eslint/no-unused-vars */
/** In-memory db fake for budget tests. Mirrors the subset of the Convex db api used by budget factories. */
interface BudgetDB {
  _next: number
  rows: BudgetRow[]
}
interface BudgetRow {
  _creationTime?: number
  _id: string
  balance: number
  inflight: number
  owner: string
  periodKey: string
}
const createBudgetDb = (): BudgetDB => ({ _next: 1, rows: [] })
const makeBudgetDb = (db: BudgetDB) => {
  const query = (_table: string) => {
    let filtered = [...db.rows]
    let ord: 'asc' | 'desc' = 'asc'
    const api = {
      collect: async () => filtered,
      first: async () => filtered[0] ?? null,
      order: (o: 'asc' | 'desc') => {
        ord = o
        return api
      },
      take: async (n: number) => (ord === 'desc' ? [...filtered].toReversed() : filtered).slice(0, n),
      unique: async () => filtered[0] ?? null,
      withIndex: (_name: string, fn: (q: unknown) => unknown) => {
        const ops: { field: string; op: string; val: unknown }[] = []
        const builder = {
          eq: (field: string, val: unknown) => {
            ops.push({ field, op: 'eq', val })
            return builder
          },
          lt: (field: string, val: unknown) => {
            ops.push({ field, op: 'lt', val })
            return builder
          }
        }
        fn(builder)
        for (const o of ops) {
          if (o.op === 'eq') filtered = filtered.filter(r => (r as unknown as Record<string, unknown>)[o.field] === o.val)
          if (o.op === 'lt')
            filtered = filtered.filter(
              r =>
                (r as unknown as Record<string, unknown>)[o.field] !== undefined &&
                ((r as unknown as Record<string, unknown>)[o.field] as number | string) < (o.val as number | string)
            )
        }
        return api
      }
    }
    return api
  }
  return {
    delete: async (id: string) => {
      db.rows = db.rows.filter(r => r._id !== id)
    },
    insert: async (_table: string, doc: Record<string, unknown>) => {
      const id = `id_${db._next}`
      db._next += 1
      const row: BudgetRow = {
        _creationTime: Date.now(),
        _id: id,
        balance: typeof doc.balance === 'number' ? doc.balance : 0,
        inflight: typeof doc.inflight === 'number' ? doc.inflight : 0,
        owner: typeof doc.owner === 'string' ? doc.owner : '',
        periodKey: typeof doc.periodKey === 'string' ? doc.periodKey : ''
      }
      db.rows.push(row)
      return id
    },
    patch: async (id: string, doc: Record<string, unknown>) => {
      for (const r of db.rows)
        if (r._id === id) {
          if (typeof doc.balance === 'number') r.balance = doc.balance
          if (typeof doc.inflight === 'number') r.inflight = doc.inflight
        }
    },
    query
  }
}
export type { BudgetDB, BudgetRow }
export { createBudgetDb, makeBudgetDb }
