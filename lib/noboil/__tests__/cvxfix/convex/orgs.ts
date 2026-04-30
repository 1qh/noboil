import type { GenericMutationCtx, GenericQueryCtx } from 'convex/server'
import { makeOrg } from '../../../src/convex/server/org'
import { mutation, query } from './_generated/server'
import { orgZodSchema } from './s'
const getAuthUserId = async (ctx: GenericMutationCtx<never> | GenericQueryCtx<never>): Promise<null | string> => {
  const id = await ctx.auth.getUserIdentity()
  return id ? id.subject : null
}
const endpoints = makeOrg({
  getAuthUserId,
  mutation,
  query,
  schema: orgZodSchema
})
export const {
  acceptInvite,
  approveJoinRequest,
  cancelJoinRequest,
  create,
  get,
  getBySlug,
  getPublic,
  invite,
  isSlugAvailable,
  leave,
  members,
  membership,
  myJoinRequest,
  myOrgs,
  pendingInvites,
  pendingJoinRequests,
  rejectJoinRequest,
  remove,
  removeMember,
  requestJoin,
  revokeInvite,
  setAdmin,
  transferOwnership,
  update
} = endpoints
