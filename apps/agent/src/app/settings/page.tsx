'use client'

import { useConvexAuth } from 'convex/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const SettingsPage = () => {
  const { isAuthenticated, isLoading } = useConvexAuth(),
    router = useRouter(),
    isTestMode = process.env.NEXT_PUBLIC_CONVEX_TEST_MODE === 'true'

  useEffect(() => {
    if (isTestMode || isLoading || isAuthenticated) return
    router.replace('/login')
  }, [isAuthenticated, isLoading, isTestMode, router])

  if (!isTestMode && (isLoading || !isAuthenticated)) return <main className='p-8'>Loading...</main>

  return (
    <main className='mx-auto max-w-2xl space-y-4 p-8'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>Settings</h1>
        <Link className='rounded-lg border px-3 py-2 text-sm' href='/'>
          Sessions
        </Link>
      </div>
      <section className='space-y-2 rounded-lg border p-4'>
        <h2 className='font-medium'>MCP Servers</h2>
        <p className='text-sm text-gray-500'>MCP server configuration will be available here.</p>
      </section>
    </main>
  )
}

export default SettingsPage
