'use client'

import { ConvexAuthNextjsProvider } from '@convex-dev/auth/nextjs'
import { ConvexReactClient } from 'convex/react'
import type { ReactNode } from 'react'

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? 'http://127.0.0.1:3212')

const AgentConvexProvider = ({ children }: { children: ReactNode }) => (
  <ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>
)

export default AgentConvexProvider
