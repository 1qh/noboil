// biome-ignore-all lint/style/noProcessEnv: intentional process.env access
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { isPublicPath } from '@a/fe/public-paths'
import AuthLayout from '@a/fe/spacetimedb-auth-layout'
import { isPlaywright } from '@a/fe/test-mode'
import { SidebarInset, SidebarProvider } from '@a/ui/sidebar'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { TOKEN_COOKIE_KEY } from 'noboil/spacetimedb'
import { Devtools } from 'noboil/spacetimedb/react'
import { SpacetimeWrapper } from './providers'
import Sidebar from './sidebar'

const metadata: Metadata = { description: 'spacetimedb chat demo', title: 'Chat' }
const Layout = async ({ children }: { children: ReactNode }) => {
  const pathname = (await headers()).get('x-pathname') ?? '/'
  const token = (await cookies()).get(TOKEN_COOKIE_KEY)?.value
  if (!(isPublicPath(pathname) || isPlaywright() || (typeof token === 'string' && token.length > 0))) redirect('/login')
  const showSidebar = !isPublicPath(pathname)
  return (
    <AuthLayout Provider={SpacetimeWrapper}>
      {showSidebar ? (
        <SidebarProvider>
          <Sidebar />
          <SidebarInset className='flex h-screen flex-col'>{children}</SidebarInset>
        </SidebarProvider>
      ) : (
        children
      )}
      <Devtools position='bottom-right' />
    </AuthLayout>
  )
}
export { metadata }
export default Layout
