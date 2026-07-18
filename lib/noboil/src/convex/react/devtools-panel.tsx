/** biome-ignore-all lint/nursery/noUndeclaredClasses: tailwind-v4 utilities biome cannot resolve */
/* eslint-disable @eslint-react/refs, @eslint-react/set-state-in-effect, react-hooks/refs */
'use client'
import { cn } from '@a/ui'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DevError, DevMutation, DevSubscription } from './devtools'
import { CacheRow, formatTime, MAX_BADGE, POSITION_CLASSES, TabBtn, WaterfallBar } from '../../shared/react/devtools-panel'
import { SLOW_THRESHOLD_MS, STALE_THRESHOLD_MS, useDevErrors } from './devtools'
/** Props for customizing the noboil DevTools panel. */
interface DevtoolsProps {
  /** Additional CSS class for the floating trigger button. */
  buttonClassName?: string
  /** Additional CSS class for both the button and panel wrapper. */
  className?: string
  /** Open the panel by default. @default false */
  defaultOpen?: boolean
  /** Tab to show when panel is first opened. @default 'errors' */
  defaultTab?: TabId
  /** Additional CSS class for the expanded panel. */
  panelClassName?: string
  /** Corner position of the floating button and panel. @default 'bottom-right' */
  position?: Position
}
type Position = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
type TabId = 'cache' | 'errors' | 'mutations' | 'subs'
const isStale = (sub: DevSubscription) => sub.status === 'loaded' && Date.now() - sub.lastUpdate > STALE_THRESHOLD_MS
const isSlow = (sub: DevSubscription) => sub.latencyMs > SLOW_THRESHOLD_MS
const countSuffix = (n: number): string => (n > 0 ? ` (${n})` : '')
const dotSuffix = (n: number, icon: string): string => (n > 0 ? ` · ${n}${icon}` : '')
const subStatusColor = (status: string, stale: boolean): string => {
  if (status === 'loaded') return stale ? 'text-foreground' : 'text-primary'
  if (status === 'error') return 'text-destructive'
  return 'text-primary'
}
const subStatusDot = (status: string, stale: boolean): string => {
  if (status === 'loaded') return stale ? 'bg-destructive' : 'bg-primary'
  if (status === 'error') return 'bg-destructive'
  return 'bg-primary'
}
const mutStatusColor = (status: string): string => {
  if (status === 'success') return 'text-primary'
  if (status === 'error') return 'text-destructive'
  return 'text-primary'
}
const mutStatusDot = (status: string): string => {
  if (status === 'success') return 'bg-primary'
  if (status === 'error') return 'bg-destructive'
  return 'animate-pulse bg-primary'
}
const ErrorRow = ({ error }: { error: DevError }) => {
  const [expanded, setExpanded] = useState(false)
  const code = error.data?.code
  const table = error.data?.table
  const op = error.data?.op
  return (
    <li className='border-b border-destructive/30 last:border-b-0'>
      <button
        className='flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-destructive/30'
        onClick={() => setExpanded(v => !v)}
        type='button'>
        <span className='shrink-0 pt-px font-mono text-destructive/60'>{formatTime(error.timestamp)}</span>
        {code ? (
          <span className='shrink-0 rounded-sm bg-destructive/50 px-1 font-mono text-destructive'>{code}</span>
        ) : null}
        <span className='min-w-0 flex-1 truncate text-destructive'>{error.message}</span>
        <span className='shrink-0 text-destructive/40'>{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>
      {expanded ? (
        <div className='space-y-1 bg-destructive/20 px-3 py-2 text-xs'>
          {table || op ? (
            <p className='font-mono text-destructive/80'>
              {table ? `table: ${table}` : ''}
              {table && op ? ' \u00B7 ' : ''}
              {op ? `op: ${op}` : ''}
            </p>
          ) : null}
          <p className='break-all whitespace-pre-wrap text-destructive/90'>{error.detail}</p>
        </div>
      ) : null}
    </li>
  )
}
const SubRow = ({ sub }: { sub: DevSubscription }) => {
  const [expanded, setExpanded] = useState(false)
  const stale = isStale(sub)
  const slow = isSlow(sub)
  const statusColor = subStatusColor(sub.status, stale)
  const statusLabel = stale ? 'stale' : sub.status
  const latencyLabel = sub.latencyMs > 0 ? `${sub.latencyMs}ms` : ''
  return (
    <li className='border-b border-border last:border-b-0'>
      <button
        className='flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/50'
        onClick={() => setExpanded(v => !v)}
        type='button'>
        <span className={cn('size-1.5 shrink-0 rounded-full', subStatusDot(sub.status, stale))} />
        <span className='min-w-0 flex-1 truncate font-mono text-foreground'>{sub.query}</span>
        {latencyLabel ? (
          <span className={cn('shrink-0 font-mono tabular-nums', slow ? 'text-foreground' : 'text-muted-foreground')}>
            {latencyLabel}
          </span>
        ) : null}
        <span className={cn('shrink-0 font-mono', statusColor)}>{statusLabel}</span>
        <span className='shrink-0 text-muted-foreground tabular-nums'>{sub.updateCount}x</span>
        {sub.renderCount > 0 ? (
          <span className='shrink-0 font-mono text-muted-foreground' title='Render count'>
            R{sub.renderCount}
          </span>
        ) : null}
        {sub.resultCount > 0 ? (
          <span className='shrink-0 font-mono text-muted-foreground' title='Result count'>
            {sub.resultCount} items
          </span>
        ) : null}
        <span className='shrink-0 text-muted-foreground/40'>{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>
      {expanded ? (
        <div className='space-y-1 bg-background/50 px-3 py-2 text-xs'>
          <p className='font-mono text-muted-foreground'>args: {sub.args}</p>
          {sub.dataPreview ? (
            <p className='max-h-32 overflow-y-auto font-mono break-all whitespace-pre-wrap text-muted-foreground'>
              {sub.dataPreview}...
            </p>
          ) : (
            <p className='font-mono text-muted-foreground'>No data yet</p>
          )}
        </div>
      ) : null}
    </li>
  )
}
const MutationRow = ({ mutation }: { mutation: DevMutation }) => {
  const statusColor = mutStatusColor(mutation.status)
  const durationLabel = mutation.durationMs > 0 ? `${mutation.durationMs}ms` : 'pending'
  return (
    <li className='flex items-center gap-2 border-b border-border px-3 py-2 text-xs last:border-b-0'>
      <span className={cn('size-1.5 shrink-0 rounded-full', mutStatusDot(mutation.status))} />
      <span className='shrink-0 pt-px font-mono text-muted-foreground'>{formatTime(mutation.startedAt)}</span>
      <span className='min-w-0 flex-1 truncate font-mono text-foreground'>{mutation.name}</span>
      <span className={cn('shrink-0 font-mono tabular-nums', statusColor)}>{durationLabel}</span>
    </li>
  )
}
const renderTriggerBadge = ({
  count,
  pendingCount,
  staleCount
}: {
  count: number
  pendingCount: number
  staleCount: number
}) => {
  if (count > 0) return <span className='text-sm font-bold'>{count > MAX_BADGE ? `${MAX_BADGE}+` : String(count)}</span>
  if (pendingCount > 0) return <span className='text-sm font-bold'>{pendingCount}</span>
  if (staleCount > 0) return <span className='text-sm font-bold'>{staleCount}</span>
  return <span className='text-base'>⚡</span>
}
const emptyMsg = (msg: string) => <p className='px-3 py-6 text-center text-xs text-muted-foreground'>{msg}</p>
/** Development-only floating panel that displays errors, subscriptions, mutations, and cache stats. */
const Devtools = ({
  buttonClassName,
  className,
  defaultOpen = false,
  defaultTab = 'errors',
  panelClassName,
  position = 'bottom-right'
}: DevtoolsProps = {}) => {
  const { cache, clear, clearMutations, errors, mutations, subscriptions } = useDevErrors()
  const posClass = POSITION_CLASSES[position]
  const [open, setOpen] = useState(defaultOpen)
  const [tab, setTab] = useState<TabId>(defaultTab)
  const [showWaterfall, setShowWaterfall] = useState(false)
  /** biome-ignore lint/style/noProcessEnv: env detection */
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') return null
  const errorCount = errors.length
  const subCount = subscriptions.length
  const mutCount = mutations.length
  const cacheCount = cache.length
  const staleCount = subscriptions.filter(isStale).length
  const slowCount = subscriptions.filter(isSlow).length
  const pendingCount = mutations.filter(m => m.status === 'pending').length
  const count = errorCount
  const hasAlert = count > 0 || staleCount > 0 || pendingCount > 0
  const minStart = subscriptions.length > 0 ? Math.min(...subscriptions.map(s => s.startedAt)) : 0
  if (!open)
    return (
      <button
        className={cn(
          'fixed',
          posClass,
          'z-9999 flex size-10 items-center justify-center rounded-full shadow-lg transition-colors',
          hasAlert
            ? 'bg-destructive text-foreground hover:bg-destructive'
            : 'bg-muted text-muted-foreground hover:bg-muted',
          className,
          buttonClassName
        )}
        onClick={() => setOpen(v => !v)}
        title='noboil DevTools'
        type='button'>
        {renderTriggerBadge({ count, pendingCount, staleCount })}
      </button>
    )
  const renderTabContent = () => {
    if (tab === 'errors')
      return errorCount === 0 ? (
        emptyMsg('No errors')
      ) : (
        <ul>
          {errors.map(e => (
            <ErrorRow error={e} key={e.id} />
          ))}
        </ul>
      )
    if (tab === 'subs') {
      if (subCount === 0) return emptyMsg('No active subscriptions')
      return showWaterfall ? (
        <ul>
          {subscriptions.map(s => (
            <WaterfallBar isSlow={isSlow} key={s.id} minStart={minStart} sub={s} />
          ))}
        </ul>
      ) : (
        <ul>
          {subscriptions.map(s => (
            <SubRow key={s.id} sub={s} />
          ))}
        </ul>
      )
    }
    if (tab === 'mutations')
      return mutCount === 0 ? (
        emptyMsg('No mutations tracked')
      ) : (
        <ul>
          {mutations.map(m => (
            <MutationRow key={m.id} mutation={m} />
          ))}
        </ul>
      )
    return cacheCount === 0 ? (
      emptyMsg('No cache entries')
    ) : (
      <ul>
        {cache.map(c => (
          <CacheRow entry={c} key={c.id} />
        ))}
      </ul>
    )
  }
  return (
    <div
      className={cn(
        'fixed',
        posClass,
        'z-9999 flex w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl',
        className,
        panelClassName
      )}>
      <div className='flex items-center justify-between border-b border-border bg-background px-3 py-2'>
        <div className='flex gap-1'>
          <TabBtn active={tab === 'errors'} label={`Errors${countSuffix(errorCount)}`} onClick={() => setTab('errors')} />
          <TabBtn
            active={tab === 'subs'}
            label={`Subs${countSuffix(subCount)}${dotSuffix(staleCount, '\u26A0')}${dotSuffix(slowCount, '\uD83D\uDC22')}`}
            onClick={() => setTab('subs')}
          />
          <TabBtn
            active={tab === 'mutations'}
            label={`Mut${countSuffix(mutCount)}${dotSuffix(pendingCount, '\u23F3')}`}
            onClick={() => setTab('mutations')}
          />
          <TabBtn active={tab === 'cache'} label={`Cache${countSuffix(cacheCount)}`} onClick={() => setTab('cache')} />
        </div>
        <div className='flex gap-1'>
          {tab === 'errors' && errorCount > 0 ? (
            <button
              className='rounded-sm px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground'
              onClick={clear}
              type='button'>
              Clear
            </button>
          ) : null}
          {tab === 'mutations' && mutCount > 0 ? (
            <button
              className='rounded-sm px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground'
              onClick={clearMutations}
              type='button'>
              Clear
            </button>
          ) : null}
          {tab === 'subs' && subCount > 0 ? (
            <button
              className='rounded-sm px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground'
              onClick={() => setShowWaterfall(v => !v)}
              type='button'>
              {showWaterfall ? 'List' : 'Waterfall'}
            </button>
          ) : null}
          <button
            className='rounded-sm px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground'
            onClick={() => setOpen(v => !v)}
            type='button'>
            ✕
          </button>
        </div>
      </div>
      <div className='max-h-80 overflow-y-auto'>{renderTabContent()}</div>
    </div>
  )
}
let autoMounted = false
const DevtoolsAutoMount = (props: DevtoolsProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (typeof document === 'undefined') return
    /** biome-ignore lint/style/noProcessEnv: env detection */
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') return
    if (autoMounted) return
    autoMounted = true
    const el = document.createElement('div')
    el.id = 'noboil-convex-devtools-portal'
    document.body.append(el)
    containerRef.current = el
    setMounted(true)
    return () => {
      autoMounted = false
      el.remove()
    }
  }, [])
  if (!(mounted && containerRef.current)) return null
  return createPortal(<Devtools {...props} />, containerRef.current)
}
export default Devtools
export { DevtoolsAutoMount }
export type { DevtoolsProps }
