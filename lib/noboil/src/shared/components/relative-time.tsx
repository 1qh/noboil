import { format, formatDistance } from 'date-fns'
import { useNow } from '../react/use-now'
/** Server render has no clock, so it falls back to the absolute date until hydration swaps in the live distance. */
const SERVER_NOW = 0
interface RelativeTimeProps {
  readonly absoluteFormat?: string
  readonly date: Date | number
  readonly tickMs?: number
}
const RelativeTime = ({ absoluteFormat = 'PP', date, tickMs }: RelativeTimeProps): string => {
  const now = useNow(tickMs)
  return now === SERVER_NOW ? format(date, absoluteFormat) : formatDistance(date, now, { addSuffix: true })
}
export { RelativeTime }
export type { RelativeTimeProps }
