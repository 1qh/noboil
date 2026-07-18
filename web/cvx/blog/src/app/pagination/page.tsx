'use client'
import { api } from '@a/be-convex'
import { Spinner } from '@a/ui/spinner'
import { Check } from 'lucide-react'
import { useInfiniteList } from 'noboil/convex/react'
import { Create, List } from '../common'

const Page = () => {
  const { data, hasMore, isLoadingMore, sentinelRef, status } = useInfiniteList(api.blog.list, {
    where: { or: [{ published: true }, { own: true }] }
  })
  const renderFooter = () => {
    if (isLoadingMore) return <Spinner className='m-auto' data-testid='loading-more' />
    if (hasMore)
      return (
        <div
          className='h-8'
          data-testid='load-more-trigger'
          ref={el => {
            sentinelRef.current = el
          }}
        />
      )
    if (status === 'Exhausted')
      return <Check className='m-auto animate-[fadeOut_2s_forwards] text-primary' data-testid='pagination-exhausted' />
    return null
  }
  return (
    <div data-testid='crud-pagination-page'>
      <Create />
      <List blogs={data} />
      {renderFooter()}
    </div>
  )
}
export default Page
