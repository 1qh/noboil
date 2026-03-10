// biome-ignore-all lint/nursery/noFloatingPromises: event handler
'use client'

import { Button } from '@a/ui/button'
import { Input } from '@a/ui/input'
import { useId, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { toast } from 'sonner'

const EmailLoginPage = () => {
  const emailId = useId(),
    auth = useAuth(),
    [login, setLogin] = useState(true),
    [pending, setPending] = useState(false),
    submitMagicLink = (email: string) => {
      ;(async () => {
        try {
          await auth.signinRedirect({
            extraQueryParams: {
              login_hint: email,
              provider: 'magic_link'
            },
            state: { flow: login ? 'signIn' : 'signUp' }
          })
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Could not continue with email')
          setPending(false)
        }
      })()
    }
  return (
    <form
      className='m-auto max-w-60 space-y-2 *:w-full'
      onSubmit={ev => {
        ev.preventDefault()
        setPending(true)
        const fd = new FormData(ev.currentTarget),
          emailVal = fd.get('email'),
          email = typeof emailVal === 'string' ? emailVal.trim() : ''
        submitMagicLink(email)
      }}>
      <Input autoComplete='email' id={emailId} name='email' placeholder='Email' />
      <Button disabled={pending} type='submit'>
        {login ? 'Continue with email' : 'Create account with email'}
      </Button>
      <button
        className='text-sm text-muted-foreground hover:text-foreground'
        onClick={() => setLogin(!login)}
        type='button'>
        {login ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
      </button>
    </form>
  )
}

export default EmailLoginPage
