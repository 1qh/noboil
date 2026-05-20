import type { ReactNode } from 'react'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { baseOptions } from '@/lib/layout.shared'
import { source } from '@/lib/source'

const Layout = ({ children }: { children: ReactNode }) => (
  <DocsLayout {...baseOptions()} tree={source.getPageTree()}>
    {children}
  </DocsLayout>
)
export default Layout
