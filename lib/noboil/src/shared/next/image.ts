type Format = 'jpeg' | 'png' | 'webp'
interface FormatOpts {
  contentType: string
  format: Format | undefined
  quality: number
}
interface ImagePipeline {
  jpeg: (options: { quality: number }) => ImagePipeline
  png: (options: { quality: number }) => ImagePipeline
  resize: (options: {
    fit: 'contain' | 'cover' | 'fill' | 'inside' | 'outside'
    height?: number
    width?: number
  }) => ImagePipeline
  toBuffer: () => Promise<Buffer>
  webp: (options: { quality: number }) => ImagePipeline
}
interface ProcessOptions {
  compress?: { quality?: number }
  format?: Format
  resize?: { fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside'; height?: number; width?: number }
}
interface TransformOpts {
  contentType: string
  options: ProcessOptions | undefined
  pipeline: ImagePipeline
  thumbnail: boolean
}
const IMAGE_TYPES = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'])
const isImageType = (contentType: string): boolean => IMAGE_TYPES.has(contentType)
const formatToMime: Record<Format, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}
const applyFormat = ({
  contentType,
  format,
  pipeline,
  quality
}: FormatOpts & { pipeline: ImagePipeline }): ImagePipeline => {
  if (format === 'jpeg') return pipeline.jpeg({ quality })
  if (format === 'png') return pipeline.png({ quality })
  if (format === 'webp') return pipeline.webp({ quality })
  const [, ext] = contentType.split('/')
  if (ext === 'jpeg' || ext === 'jpg') return pipeline.jpeg({ quality })
  if (ext === 'png') return pipeline.png({ quality })
  if (ext === 'webp') return pipeline.webp({ quality })
  return pipeline
}
const applyTransforms = ({ contentType, options, pipeline, thumbnail }: TransformOpts): ImagePipeline => {
  const DEFAULT_QUALITY = 80
  const THUMB_SIZE = 200
  const quality = options?.compress?.quality ?? DEFAULT_QUALITY
  if (thumbnail)
    return pipeline.resize({ fit: 'cover', height: THUMB_SIZE, width: THUMB_SIZE }).webp({ quality: DEFAULT_QUALITY })
  let result = pipeline
  if (options?.resize)
    result = result.resize({
      fit: options.resize.fit ?? 'cover',
      height: options.resize.height,
      width: options.resize.width
    })
  if (options?.format || options?.compress)
    result = applyFormat({ contentType, format: options.format, pipeline: result, quality })
  return result
}
export type { Format, FormatOpts, ImagePipeline, ProcessOptions, TransformOpts }
export { applyFormat, applyTransforms, formatToMime, isImageType }
