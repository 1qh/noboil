'use client'

import { api } from '@a/be-convex'
import { createOrgHooks } from '@ohmystack/convex/react'

export const { useActiveOrg, useMyOrgs, useOrg } = createOrgHooks(api.org)
