/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
'use client'
import { api } from '@a/be-convex'
import ChatSidebar from '@a/fe/chat-sidebar'
import { Spinner } from '@a/ui/spinner'
import { useMutation } from 'convex/react'
import { Check } from 'lucide-react'
import { useList } from 'noboil/convex/react'
import { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'

const Sb = () => {
  const { inView, ref } = useInView()
  const { data, loadMore, status } = useList(api.chat.list, { where: { own: true } })
  const deleteChat = useMutation(api.chat.rm)
  const handleDelete = async (chatId: string) => {
    await deleteChat({ id: chatId })
  }
  useEffect(() => {
    if (inView && status === 'CanLoadMore') loadMore()
  }, [inView, loadMore, status])
  const renderStatus = () => {
    if (status === 'LoadingMore') return <Spinner />
    if (status === 'CanLoadMore') return <p className='h-4' ref={ref} />
    if (status === 'Exhausted' && data.length > 20) return <Check className='animate-[fadeOut_2s_forwards] text-primary' />
    return null
  }
  return (
    <>
      <ChatSidebar basePath='' getThreadId={thread => thread._id as string} onDelete={handleDelete} threads={data} />
      <div className='flex justify-center p-2'>{renderStatus()}</div>
    </>
  )
}
export default Sb
