import type { ImagePipeline } from './shared/next/image'

declare module 'sharp' {
  const sharp: (input: Buffer) => ImagePipeline
  export default sharp
}
