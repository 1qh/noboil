'use client'
import type { Chat } from '@a/be-spacetimedb/spacetimedb/types'
import { reducers, tables } from '@a/be-spacetimedb/spacetimedb'
import ChatSidebar from '@a/fe/chat-sidebar'
import { toIdentityKey } from '@a/fe/utils'
import { Spinner } from '@a/ui/spinner'
import { Check } from 'lucide-react'
import { useMut } from 'noboil/spacetimedb/react'
import { useSpacetimeDB, useTable } from 'spacetimedb/react'

const Sb = () => {
  const { identity } = useSpacetimeDB()
  const [allChats, isReady] = useTable(tables.chat)
  const deleteChat = useMut(reducers.rmChat, {
    getName: (args: { id: number }) => `chat.rm:${args.id}`,
    toast: { error: 'Failed to delete conversation', success: 'Conversation deleted' }
  })
  const identityKey = toIdentityKey(identity)
  const chats: Chat[] = allChats
    .filter(c => toIdentityKey(c.userId) === identityKey)
    .toSorted((a, b) => Number(b.updatedAt) - Number(a.updatedAt))
  const handleDelete = async (chatId: number) => {
    await deleteChat({ id: chatId })
  }
  const renderStatus = () => {
    if (!isReady) return <Spinner />
    if (chats.length > 20) return <Check className='animate-[fadeOut_2s_forwards] text-primary' />
    return null
  }
  return (
    <>
      <ChatSidebar basePath='' getThreadId={thread => thread.id} onDelete={handleDelete} threads={chats} />
      <div className='flex justify-center p-2'>{renderStatus()}</div>
    </>
  )
}
export default Sb
