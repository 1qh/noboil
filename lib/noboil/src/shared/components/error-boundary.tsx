/** biome-ignore-all lint/nursery/noUndeclaredClasses: tailwind-v4 utilities biome cannot resolve */
/* eslint-disable react/require-optimization, react/sort-comp */
/* eslint-disable react/no-set-state */
'use client'
import type { ErrorInfo, ReactNode } from 'react'
import { cn } from '@a/ui'
import { Button } from '@a/ui/button'
import { Component } from 'react'

interface CreateErrorBoundaryOptions {
  readErrorCode: (error: Error) => string | undefined
  readErrorMessage: (error: Error) => string
}
interface ErrorBoundaryProps {
  children: ReactNode
  className?: string
  fallback?: (props: { error: Error; resetErrorBoundary: () => void }) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}
interface ErrorBoundaryState {
  error: Error | null
}
const createErrorBoundary = ({ readErrorCode, readErrorMessage }: CreateErrorBoundaryOptions) => {
  // biome-ignore lint/nursery/noComponentHookFactories: field/handler factory, not a component/hook
  class SharedErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    public constructor(props: ErrorBoundaryProps) {
      super(props)
      this.state = { error: null }
    }
    public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
      return { error }
    }
    public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
      const { onError } = this.props
      if (onError) onError(error, errorInfo)
    }
    // eslint-disable-next-line @typescript-eslint/promise-function-async, sonarjs/function-return-type -- React 19 ReactNode includes Promise so render reads as async-returning; render is a synchronous lifecycle method returning children passthrough or fallback/error UI
    public override render() {
      const { error } = this.state
      const { children, className, fallback } = this.props
      if (!error) return children
      if (fallback)
        return (
          <>
            {fallback({
              error,
              resetErrorBoundary: () => this.setState({ error: null })
            })}
          </>
        )
      const code = readErrorCode(error)
      const message = readErrorMessage(error)
      return (
        <div className={cn('flex min-h-[200px] items-center justify-center p-6', className)}>
          <div className='max-w-md space-y-3 text-center'>
            {code ? (
              <span className='rounded-sm bg-destructive/10 px-2 py-1 font-mono text-xs text-destructive'>{code}</span>
            ) : null}
            <h2 className='text-lg font-semibold text-foreground dark:text-foreground'>Something went wrong</h2>
            <p className='text-sm text-muted-foreground dark:text-muted-foreground'>{message}</p>
            <Button onClick={() => this.setState({ error: null })} type='button' variant='outline'>
              Try again
            </Button>
          </div>
        </div>
      )
    }
  }
  return SharedErrorBoundary
}
export type { ErrorBoundaryProps, ErrorBoundaryState }
export { createErrorBoundary }
