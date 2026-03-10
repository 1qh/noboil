'use client'

import type { Chat } from '@a/be-spacetimedb/spacetimedb/types'

import { reducers, tables } from '@a/be-spacetimedb/spacetimedb'
import { toIdentityKey } from '@a/fe/utils'
import { Spinner } from '@a/ui/spinner'
import { useMut } from '@noboil/spacetimedb/react'
import { Check } from 'lucide-react'
import { useSpacetimeDB, useTable } from 'spacetimedb/react'

import ChatSidebar from './chat-sidebar'

const Sb = () => {
  const { identity } = useSpacetimeDB(),
    [allChats, isReady] = useTable(tables.chat),
    deleteChat = useMut(reducers.rmChat, {
      getName: (args: { id: number }) => `chat.rm:${args.id}`,
      toast: { error: 'Failed to delete conversation', success: 'Conversation deleted' }
    }),
    identityKey = toIdentityKey(identity),
    chats: Chat[] = allChats
      .filter(c => toIdentityKey(c.userId) === identityKey)
      .toSorted((a, b) => (a.updatedAt > b.updatedAt ? -1 : a.updatedAt < b.updatedAt ? 1 : 0)),
    handleDelete = async (chatId: number) => {
      await deleteChat({ id: chatId })
    }

  return (
    <>
      <ChatSidebar basePath='' onDelete={handleDelete} threads={chats} />
      <div className='flex justify-center p-2'>
        {isReady ? (
          chats.length > 20 ? (
            <Check className='animate-[fadeOut_2s_forwards] text-green-500' />
          ) : null
        ) : (
          <Spinner />
        )}
      </div>
    </>
  )
}

export default Sb
