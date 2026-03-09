'use client'

import { reducers } from '@a/be-spacetimedb/spacetimedb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@a/ui/card'
import { FieldGroup } from '@a/ui/field'
import slugify from '@sindresorhus/slugify'
import { Form, useFormMutation } from '@ohmystack/spacetimedb/components'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useReducer } from 'spacetimedb/react'

import { orgTeam } from '~/schema'

const NewOrgPage = () => {
  const router = useRouter(),
    form = useFormMutation({
      mutate: useReducer(reducers.orgCreate),
      onSuccess: () => router.push('/'),
      schema: orgTeam,
      toast: { success: 'Organization created' },
      transform: d => ({ ...d, avatarId: undefined })
    }),
    name = form.watch('name'),
    slug = form.watch('slug'),
    autoSlugRef = useRef(true)

  useEffect(() => {
    if (autoSlugRef.current) form.instance.setFieldValue('slug', slugify(name))
  }, [name, form.instance])

  return (
    <div className='container flex justify-center py-8'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle>Create organization</CardTitle>
          <CardDescription>Start collaborating with your team</CardDescription>
        </CardHeader>
        <CardContent>
          <Form
            className='space-y-4'
            form={form}
            render={({ Submit, Text }) => (
              <>
                <FieldGroup>
                  <Text helpText='Public organization name.' name='name' placeholder='Acme Inc' required />
                  <Text
                    helpText='Lowercase letters, numbers, and dashes.'
                    label='URL slug'
                    name='slug'
                    placeholder='acme-inc'
                    required
                  />
                </FieldGroup>
                <p className='text-xs text-muted-foreground'>/{slug || 'your-slug'}</p>
                <Submit className='w-full'>Create organization</Submit>
              </>
            )}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default NewOrgPage
