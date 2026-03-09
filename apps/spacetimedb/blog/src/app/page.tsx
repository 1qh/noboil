'use client'

import { tables } from '@a/be-spacetimedb/spacetimedb'
import { Input } from '@a/ui/input'
import { useList, useOwnRows } from '@ohmystack/spacetimedb/react'
import { Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useSpacetimeDB, useTable } from 'spacetimedb/react'

import { Create, List } from './common'

const Page = () => {
  const [allBlogs, isReady] = useTable(tables.blog),
    { identity } = useSpacetimeDB(),
    blogs = useOwnRows(allBlogs, identity ? (b: (typeof allBlogs)[number]) => b.userId.isEqual(identity) : null),
    [removedIds, setRemovedIds] = useState<Set<number>>(() => new Set()),
    [query, setQuery] = useState(''),
    { data, hasMore, isLoading, loadMore } = useList(blogs, isReady, {
      search: { debounceMs: 200, fields: ['title', 'content', 'tags'], query },
      sort: { direction: 'desc', field: 'id' },
      where: { or: [{ published: true }, { own: true }] }
    }),
    filtered = useMemo(() => {
      if (removedIds.size === 0) return data
      const out: typeof data = []
      for (const b of data) if (!removedIds.has(b.id)) out.push(b)
      return out
    }, [data, removedIds]),
    handleRemove = useCallback((id: number) => {
      setRemovedIds(prev => new Set(prev).add(id))
    }, [])
  return (
    <div data-testid='crud-dynamic-page'>
      <Create />
      <div className='relative mb-4'>
        <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
        <Input
          className='pl-9'
          data-testid='blog-search-input'
          onChange={e => setQuery(e.target.value)}
          placeholder='Search blogs...'
          type='search'
          value={query}
        />
      </div>
      <List blogs={filtered} onRemove={handleRemove} />
      {!query && hasMore && !isLoading ? (
        <button
          className='mx-auto mt-4 block text-sm text-muted-foreground hover:text-foreground'
          onClick={() => loadMore()}
          type='button'>
          Load more
        </button>
      ) : null}
    </div>
  )
}

export default Page
