import { source } from '@/lib/source'
import type { ReactNode } from 'react'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'

const Layout = ({ children }: { children: ReactNode }) => (
  <DocsLayout nav={{ title: 'ohmystack' }} tree={source.getPageTree()}>
    {children}
  </DocsLayout>
)

export default Layout
