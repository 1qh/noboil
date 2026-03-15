'use client'

import { api } from '@a/be-agent'
import type { Id } from '@a/be-agent/model'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

const ChatPage = () => {
  const [draft, setDraft] = useState(''),
    [sending, setSending] = useState(false),
    { isAuthenticated, isLoading } = useConvexAuth(),
    router = useRouter(),
    isTestMode = process.env.NEXT_PUBLIC_CONVEX_TEST_MODE === 'true',
    params = useParams<{ id: string }>(),
    id = params.id as Id<'session'>,
    session = useQuery(api.sessions.getSession, { sessionId: id }),
    messages = useQuery(api.messages.listMessages, session ? { threadId: session.threadId } : 'skip'),
    submitMessage = useMutation(api.orchestrator.submitMessage),
    onSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const content = draft.trim()
      if (!content || sending || !session) return
      setSending(true)
      try {
        await submitMessage({ content, sessionId: session._id })
        setDraft('')
      } finally {
        setSending(false)
      }
    }

  useEffect(() => {
    if (isTestMode || isLoading || isAuthenticated) return
    router.replace('/login')
  }, [isAuthenticated, isLoading, isTestMode, router])

  if (!isTestMode && (isLoading || !isAuthenticated)) return <main className='p-8'>Loading...</main>
  if (!session) return <main className='p-8'>Loading...</main>
  if (messages === undefined) return <main className='p-8'>Loading...</main>

  return (
    <main className='mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 p-4 md:p-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-lg font-semibold'>{session.title ?? 'Untitled Session'}</h1>
        <div className='flex items-center gap-2'>
          <Link className='rounded-lg border px-3 py-2 text-sm' href='/'>
            Sessions
          </Link>
          <Link className='rounded-lg border px-3 py-2 text-sm' href='/settings'>
            Settings
          </Link>
        </div>
      </div>

      <section className='flex-1 space-y-3 overflow-y-auto rounded-lg border p-3 md:p-4'>
        {messages.length === 0 ? <p className='text-sm text-gray-500'>No messages yet.</p> : null}
        {messages.map(m => (
          <article className='rounded-lg border p-3' key={m._id}>
            <div className='mb-1 text-xs uppercase text-gray-500'>{m.role}</div>
            <p className='whitespace-pre-wrap text-sm'>{m.isComplete ? m.content : (m.streamingContent ?? m.content)}</p>
          </article>
        ))}
      </section>

      <form className='flex gap-2' onSubmit={onSubmit}>
        <input
          className='flex-1 rounded-lg border px-3 py-2'
          disabled={sending}
          onChange={event => setDraft(event.target.value)}
          placeholder='Message the agent'
          value={draft}
        />
        <button className='rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-60' disabled={sending} type='submit'>
          Send
        </button>
      </form>
    </main>
  )
}

export default ChatPage
