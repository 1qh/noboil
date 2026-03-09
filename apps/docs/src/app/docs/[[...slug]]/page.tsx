import { getMDXComponents } from '@/mdx-components'
import { source } from '@/lib/source'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

const Page = async (props: { params: Promise<{ slug?: string[] }> }) => {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()

  const Content = page.data.body

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <Content
          components={getMDXComponents({
            a: createRelativeLink(source, page)
          })}
        />
      </DocsBody>
    </DocsPage>
  )
}

const generateStaticParams = async () => source.generateParams()

const generateMetadata = async (props: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> => {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()

  return {
    title: page.data.title,
    description: page.data.description
  }
}

export default Page
export { generateMetadata, generateStaticParams }
