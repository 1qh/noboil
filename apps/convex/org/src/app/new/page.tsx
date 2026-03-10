'use client'

import { api } from '@a/be-convex'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@a/ui/card'
import { FieldGroup } from '@a/ui/field'
import { Form, useForm } from '@noboil/convex/components'
import slugify from '@sindresorhus/slugify'
import { useMutation } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { orgTeam } from '~/schema'

const NewOrgPage = () => {
  const router = useRouter(),
    create = useMutation(api.org.create),
    form = useForm({
      onSubmit: async d => {
        await create({ data: d })
        toast.success('Organization created')
        router.push('/')
        return d
      },
      resetOnSuccess: true,
      schema: orgTeam
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
                  <Text name='name' placeholder='Acme Inc' />
                  <Text label='URL slug' name='slug' placeholder='acme-inc' />
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
