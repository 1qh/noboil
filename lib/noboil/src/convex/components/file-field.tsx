/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
/** biome-ignore-all lint/nursery/noUndeclaredClasses: tailwind-v4 utilities biome cannot resolve */
/* eslint-disable @typescript-eslint/no-misused-promises, @typescript-eslint/strict-void-return */
/* oxlint-disable jsx-no-new-object-as-prop, jsx-a11y/prefer-tag-over-role */
// oxlint-disable promise/prefer-await-to-then, next/no-img-element
/* eslint-disable complexity, no-await-in-loop, @next/next/no-img-element */
'use client'
import type { AnyFieldApi } from '@tanstack/react-form'
import type { FunctionReference } from 'convex/server'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@a/ui'
import { Field, FieldError, FieldLabel } from '@a/ui/field'
import { useQuery } from 'convex/react'
import { FileIcon, ImageIcon, Upload, X } from 'lucide-react'
import { createContext, use, useCallback, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import type { UploadResult } from '../react/use-upload'
import { compress, fmt, isImgType, parseAccept } from '../../shared/components/file-utils'
import useUpload from '../react/use-upload'

interface FileApi {
  info: FunctionReference<'query'>
  upload: FunctionReference<'mutation'>
}
const FileApiContext = createContext<FileApi | null>(null)
FileApiContext.displayName = 'FileApiContext'
const FileApiProvider = ({ children, value }: { children: ReactNode; value: FileApi }) => (
  <FileApiContext value={value}>{children}</FileApiContext>
)
const useFileApi = () => {
  const ctx = use(FileApiContext)
  if (!ctx)
    throw new Error('<File /> requires <FileApiProvider />. Wrap your layout with it or pass fileApi to your providers.')
  return ctx
}
const Preview = ({ id, onRemove }: { id: string; onRemove?: () => void }) => {
  const { info } = useFileApi()
  const d = useQuery(info, { id }) as null | undefined | { contentType: string; size: number; url: null | string }
  if (!d) return <p className='size-16 animate-pulse rounded-lg bg-muted' />
  return (
    <div className='relative'>
      {d.contentType && isImgType(d.contentType) && d.url ? (
        /** biome-ignore lint/performance/noImgElement: intentional img, not Next.js context */
        <img alt='' className='size-16 rounded-lg object-cover' height={64} src={d.url} width={64} />
      ) : (
        <div className='flex size-16 flex-col items-center justify-center rounded-lg bg-muted text-xs'>
          <FileIcon className='size-6 text-muted-foreground' />
          <span className='mt-1'>{fmt(d.size)}</span>
        </div>
      )}
      {onRemove ? (
        <button
          className='absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-foreground transition-transform hover:scale-110'
          onClick={onRemove}
          type='button'>
          <X className='size-3' />
        </button>
      ) : null}
    </div>
  )
}
const Progress = ({ v }: { v: number }) => (
  <div className='flex flex-col items-center'>
    <div className='mb-2 h-2 w-32 overflow-hidden rounded-full bg-muted'>
      <div className='h-full bg-primary transition-all' style={{ width: `${v}%` }} />
    </div>
    <span className='text-sm text-muted-foreground'>{v}%</span>
  </div>
)
const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  ABORTED: 'Upload canceled',
  INVALID_RESPONSE: 'Invalid response',
  NETWORK: 'Network error'
}
const uploadErrorText = (res: { code?: string; status?: number }): string => {
  if (res.code === 'HTTP') return `Upload failed (${res.status})`
  return UPLOAD_ERROR_MESSAGES[res.code ?? ''] ?? 'Failed to start upload'
}
const dropRejectionText = (code: string | undefined, maxSize?: number, max?: number): null | string => {
  if (code === 'file-too-large' && maxSize) return `Max ${fmt(maxSize)}`
  if (code === 'file-invalid-type') return 'Invalid type'
  if (code === 'too-many-files' && max) return `Max ${max}`
  return null
}
const runDropUpload = async (opts: {
  accepted: File[]
  compressImg?: boolean
  f: AnyFieldApi
  max?: number
  multiple?: boolean
  upload: (file: File) => Promise<UploadResult>
  vals: string[]
}): Promise<void> => {
  const { accepted, compressImg, f, max, multiple, upload, vals } = opts
  if (multiple && max && vals.length + accepted.length > max) {
    toast.error(`Max ${max}`)
    return
  }
  const ids: string[] = []
  for (const file of accepted) {
    /** biome-ignore lint/performance/noAwaitInLoops: sequential by design */
    const res = await upload(await compress(file, compressImg ?? true))
    if (res.ok) ids.push(res.storageId)
    else toast.error(`${file.name}: ${uploadErrorText(res)}`)
  }
  if (multiple) f.handleChange([...vals, ...ids])
  else if (ids[0]) f.handleChange(ids[0])
}
const FileFieldImpl = ({
  accept,
  compressImg = true,
  'data-testid': testId,
  disabled,
  dropClassName,
  field: f,
  label,
  max,
  maxSize,
  multiple,
  ...props
}: Omit<ComponentProps<typeof Field>, 'children'> & {
  accept?: string
  compressImg?: boolean
  'data-testid'?: string
  disabled?: boolean
  dropClassName?: string
  field: AnyFieldApi
  label?: string
  max?: number
  maxSize?: number
  multiple?: boolean
  // eslint-disable-next-line sonarjs/cognitive-complexity -- file-field component: dropzone config + upload state + conditional single/multi preview and drop rendering
}) => {
  const { upload: uploadRef } = useFileApi()
  const raw: unknown = f.state.value
  const name = f.name as string
  const vals = useMemo<string[]>(() => {
    if (multiple) return (raw ?? []) as string[]
    return raw ? [raw as string] : []
  }, [multiple, raw])
  const inv = f.state.meta.isTouched && !f.state.meta.isValid
  const canAdd = multiple ? !max || vals.length < max : vals.length === 0
  const { isUploading, progress, reset, upload } = useUpload(uploadRef)
  const errorId = `${name}-error`
  const onDrop = useCallback(
    async (accepted: File[]) => runDropUpload({ accepted, compressImg, f, max, multiple, upload, vals }),
    [compressImg, f, max, multiple, upload, vals]
  )
  const { getInputProps, getRootProps, inputRef, isDragActive } = useDropzone({
    accept: parseAccept(accept),
    disabled: disabled ?? (isUploading || !canAdd),
    maxSize,
    multiple: Boolean(multiple),
    onDrop,
    onDropRejected: r => {
      const msg = dropRejectionText(r[0]?.errors[0]?.code, maxSize, max)
      if (msg) toast.error(msg)
    }
  })
  const dropCls = cn(
    'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
    multiple ? 'size-16' : 'p-6',
    isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
    (disabled ?? isUploading) && 'cursor-not-allowed opacity-50',
    dropClassName
  )
  const tid = testId ?? name
  const singleView = vals[0] ? (
    <Preview
      id={vals[0]}
      onRemove={() => {
        f.handleChange(null)
        reset()
      }}
    />
  ) : (
    <>
      <input
        {...getInputProps()}
        aria-describedby={inv ? errorId : undefined}
        aria-hidden='true'
        aria-invalid={inv}
        aria-label={label ?? 'File upload'}
        tabIndex={-1}
      />
      {/* biome-ignore lint/a11y/useSemanticElements: intentional role, semantic element not applicable */}
      <div
        {...getRootProps()}
        aria-label='Upload file'
        className={dropCls}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current.click()
          }
        }}
        role='button'
        tabIndex={0}>
        {isUploading ? (
          <Progress v={progress} />
        ) : (
          <>
            {accept?.includes('image') ? (
              <ImageIcon className='mb-2 size-8 text-muted-foreground' />
            ) : (
              <Upload className='mb-2 size-8 text-muted-foreground' />
            )}
            <span className='text-sm text-muted-foreground'>Click or drag</span>
            {maxSize ? <span className='mt-1 text-xs text-muted-foreground'>Max {fmt(maxSize)}</span> : null}
          </>
        )}
      </div>
    </>
  )
  return (
    <Field {...props} data-invalid={inv} data-testid={tid}>
      {label ? (
        <FieldLabel htmlFor={name}>
          {label}
          {multiple && max ? (
            <span className='text-muted-foreground'>
              {' '}
              ({vals.length}/{max})
            </span>
          ) : null}
        </FieldLabel>
      ) : null}
      {multiple ? (
        <div className='flex flex-wrap gap-2'>
          {vals.map((id, i) => (
            <Preview id={id} key={id} onRemove={() => f.handleChange(vals.filter((_, j) => j !== i))} />
          ))}
          {canAdd ? (
            <>
              <input
                {...getInputProps()}
                aria-describedby={inv ? errorId : undefined}
                aria-hidden='true'
                aria-invalid={inv}
                aria-label={label ?? 'File upload'}
                tabIndex={-1}
              />
              {/* biome-ignore lint/a11y/useSemanticElements: intentional role, semantic element not applicable */}
              <div
                {...getRootProps()}
                aria-label='Upload file'
                className={dropCls}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    inputRef.current.click()
                  }
                }}
                role='button'
                tabIndex={0}>
                {isUploading ? (
                  <span className='text-xs'>{progress}%</span>
                ) : (
                  <Upload className='size-5 text-muted-foreground' />
                )}
              </div>
            </>
          ) : null}
        </div>
      ) : (
        singleView
      )}
      {inv ? <FieldError errors={f.state.meta.errors} id={errorId} /> : null}
    </Field>
  )
}
/** Exports FileFieldImpl component and file API context. */
export default FileFieldImpl
export { FileApiContext, FileApiProvider }
