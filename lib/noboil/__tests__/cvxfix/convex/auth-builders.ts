import type { GenericMutationCtx, GenericQueryCtx } from 'convex/server'
import { customCtx } from 'convex-helpers/server/customFunctions'
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4'
import type { Mb, Qb } from '../../../src/convex/server/types'
import { mutation, query } from './_generated/server'
const subjectFromCtx = async (ctx: GenericMutationCtx<never> | GenericQueryCtx<never>): Promise<string> => {
  const id = await ctx.auth.getUserIdentity()
  if (!id) throw new Error('NOT_AUTHENTICATED')
  return id.subject
}
const userCtx = (uid: string) => ({
  get: () => ({ _id: uid as never }),
  user: { _id: uid as never } as never,
  viewerId: uid as never,
  withAuthor: <T>(d: T): T => d
})
const m = zCustomMutation(
  mutation,
  customCtx(async (ctx: GenericMutationCtx<never>) => userCtx(await subjectFromCtx(ctx)))
) as unknown as Mb
const q = zCustomQuery(
  query,
  customCtx(async (ctx: GenericQueryCtx<never>) => userCtx(await subjectFromCtx(ctx)))
) as unknown as Qb
const cm = zCustomMutation(
  mutation,
  customCtx(() => ({}))
) as unknown as Mb
const cq = zCustomQuery(
  query,
  customCtx(() => ({}))
) as unknown as Qb
export { cm, cq, m, q }
