import type { s } from '@a/be-spacetimedb/s'
import type { InferCreate } from 'noboil/spacetimedb'

type MovieDetailData = InferCreate<typeof s.movie>
interface SearchResult {
  id: number
  overview: string
  poster_path: null | string
  release_date: string
  title: string
  tmdb_id: number
  vote_average: number
}
export type { MovieDetailData, SearchResult }
