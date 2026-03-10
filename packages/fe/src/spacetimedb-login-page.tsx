// biome-ignore-all lint/nursery/noFloatingPromises: event handler
'use client'

import { Button } from '@a/ui/button'
import Link from 'next/link'
import { useAuth } from 'react-oidc-context'
import { toast } from 'sonner'

interface LoginPageProps {
  emailLoginPath?: string
  redirectTo?: string
}

const LoginPage = ({ emailLoginPath = '/login/email', redirectTo = '/' }: LoginPageProps) => {
  const auth = useAuth(),
    signInWithGoogle = () => {
      ;(async () => {
        try {
          await auth.signinRedirect({
            extraQueryParams: { provider: 'google' },
            state: { redirectTo }
          })
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Could not sign in')
        }
      })()
    }
  return (
    <div className='m-auto space-y-2'>
      <Button
        className='group rounded-full pr-5! tracking-tight transition-all duration-300 hover:scale-105 hover:gap-1 hover:pl-2 active:scale-90'
        onClick={signInWithGoogle}>
        Continue with Google
      </Button>
      <Link
        className='block text-center text-sm font-light text-muted-foreground transition-all duration-300 hover:font-normal hover:text-foreground'
        href={emailLoginPath}>
        Log in with email
      </Link>
    </div>
  )
}

export default LoginPage
