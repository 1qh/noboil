/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: intentional HTML injection — trusted client-side redirect with encodeURIComponent-escaped values */
/* eslint-disable @eslint-react/dom-no-dangerously-set-innerhtml, react/no-danger, @eslint-react/set-state-in-effect */
/* oxlint-disable jsx-no-new-array-as-prop */
'use client'
import type { Org, OrgMember } from '@a/be-spacetimedb/spacetimedb/types'
import type { OrgRole } from 'noboil/spacetimedb'
import type { ReactNode } from 'react'
import { tables } from '@a/be-spacetimedb/spacetimedb'
import AuthLayout from '@a/fe/spacetimedb-auth-layout'
import { isPlaywright } from '@a/fe/test-mode'
import { sameIdentity } from '@a/fe/utils'
import { usePathname, useRouter } from 'next/navigation'
import { Devtools, useStdbHydrated } from 'noboil/spacetimedb/react'
import { useEffect, useState } from 'react'
import { useSpacetimeDB, useTable } from 'spacetimedb/react'
import OrgLayoutClient from './layout-client'
import { SpacetimeWrapper } from './providers'

const ORG_PATHS = ['/dashboard', '/members', '/projects', '/wiki', '/settings']
const needsOrgLayout = (pathname: string) => {
  for (const p of ORG_PATHS) if (pathname === p || pathname.startsWith(`${p}/`)) return true
  return false
}
const toOrgId = (id: number) => `${id}`
const OrgRedirect = ({ orgId, slug, to }: { orgId: string; slug: string; to: string }) => (
  <script
    // oxlint-disable-next-line react/no-danger, jsx-no-new-object-as-prop
    dangerouslySetInnerHTML={{
      __html: `window.location.href="/api/set-org?orgId=${encodeURIComponent(orgId)}&slug=${encodeURIComponent(slug)}&to=${encodeURIComponent(to)}"`
    }}
  />
)
const readActiveOrgId = () => {
  if (typeof document === 'undefined') return null
  const cookies = document.cookie.split('; ')
  for (const c of cookies) {
    if (c.startsWith('activeOrgId=')) return c.slice('activeOrgId='.length)
    if (c.startsWith('active_org=')) return c.slice('active_org='.length)
  }
  return null
}
const toLegacyOrg = (org: Org) => ({ ...org, _id: toOrgId(org.id) })
// eslint-disable-next-line @typescript-eslint/promise-function-async
const OrgLayoutInner = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname()
  const router = useRouter()
  const { identity } = useSpacetimeDB()
  const [orgs] = useTable(tables.org)
  const [members] = useTable(tables.orgMember)
  const hydrated = useStdbHydrated([tables.org, tables.orgMember])
  const activeOrgId = readActiveOrgId()
  const [playwrightWaitExpired, setPlaywrightWaitExpired] = useState(false)
  /** biome-ignore lint/correctness/useExhaustiveDependencies: retrigger on navigation */
  useEffect(() => {
    if (!isPlaywright()) return
    setPlaywrightWaitExpired(false)
    const timer = globalThis.setTimeout(() => setPlaywrightWaitExpired(true), 5000)
    return () => globalThis.clearTimeout(timer)
  }, [activeOrgId, pathname])
  if (!pathname) return children
  if (!needsOrgLayout(pathname)) return children
  if (!(identity || isPlaywright())) return null
  if (!(hydrated || playwrightWaitExpired)) return null
  // oxlint-disable-next-line jsx-no-new-array-as-prop
  const ownedOrgs = identity ? orgs.filter((o: Org) => sameIdentity(o.userId, identity)) : []
  const memberOrgs = identity
    ? members
        .filter((m: OrgMember) => m.userId.toHexString() === identity.toHexString())
        .map((m: OrgMember) => {
          const org = orgs.find((o: Org) => o.id === m.orgId)
          if (!org) return null
          const role: OrgRole = sameIdentity(org.userId, identity) ? 'owner' : m.isAdmin ? 'admin' : 'member'
          return { org: toLegacyOrg(org), role }
        })
        .filter(item => item !== null)
    : []
  const ownedItems = ownedOrgs
    .filter((o: Org) => !memberOrgs.some(m => m.org._id === String(o.id)))
    .map((o: Org) => ({ org: toLegacyOrg(o), role: 'owner' as const }))
  const myOrgItems = identity
    ? [...ownedItems, ...memberOrgs]
    : orgs.map((o: Org) => ({
        org: toLegacyOrg(o),
        role: 'owner' as const
      }))
  if (myOrgItems.length === 0) {
    if (isPlaywright() && !playwrightWaitExpired) return null
    router.replace('/')
    return null
  }
  const active = (activeOrgId ? myOrgItems.find(item => item.org._id === activeOrgId) : null) ?? myOrgItems[0]
  if (!active) {
    router.replace('/')
    return null
  }
  if (activeOrgId !== active.org._id) return <OrgRedirect orgId={active.org._id} slug={active.org.slug} to={pathname} />
  return (
    <OrgLayoutClient membership={null} org={active.org} orgs={myOrgItems} role={active.role}>
      {children}
    </OrgLayoutClient>
  )
}
const LayoutContent = ({ children }: { children: ReactNode }) => (
  <>
    <OrgLayoutInner>{children}</OrgLayoutInner>
    <Devtools position='bottom-right' />
  </>
)
const Layout = ({ children }: { children: ReactNode }) => (
  <AuthLayout Provider={SpacetimeWrapper}>
    <title>Org</title>
    <LayoutContent>{children}</LayoutContent>
  </AuthLayout>
)
export { OrgRedirect }
export default Layout
