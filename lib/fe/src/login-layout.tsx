import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@a/ui'

interface LoginLayoutProps {
  children: ReactNode
  className?: string
  wrapperProps?: Omit<ComponentProps<'div'>, 'children'>
}
const LoginLayout = ({ children, className, wrapperProps }: LoginLayoutProps) => (
  <div
    {...wrapperProps}
    // biome-ignore lint/nursery/noUndeclaredClasses: valid tailwind-v4 utilities biome can't resolve
    className={cn('flex h-screen w-screen items-center justify-center', className, wrapperProps?.className)}>
    {children}
  </div>
)
export default LoginLayout
