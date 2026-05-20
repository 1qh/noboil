/** biome-ignore-all lint/style/noProcessEnv: server-side env read */
'use server'
import { TMDB } from '@lorenzopant/tmdb'
import { isStdbTestMode } from 'noboil/spacetimedb'
import type { MovieDetailData, SearchResult } from './_movie-types'

interface TmdbSearchResponse {
  results: SearchResult[]
}
const PLAYWRIGHT_SEARCH: SearchResult[] = [
  {
    id: 27_205,
    overview: 'A thief steals information by infiltrating dreams.',
    poster_path: '/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
    release_date: '2010-07-16',
    title: 'Inception',
    tmdb_id: 27_205,
    vote_average: 8.4
  },
  {
    id: 550,
    overview: 'An insomniac office worker crosses paths with a soap maker.',
    poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    release_date: '1999-10-15',
    title: 'Fight Club',
    tmdb_id: 550,
    vote_average: 8.4
  },
  {
    id: 268,
    overview: 'Batman faces his fear in a city consumed by crime.',
    poster_path: '/iA5qZ0v8Yk4wG6K0Ff5mX2lQmR9.jpg',
    release_date: '1989-06-23',
    title: 'Batman',
    tmdb_id: 268,
    vote_average: 7.2
  },
  {
    id: 364,
    overview: 'Batman Returns to Gotham to stop a new menace.',
    poster_path: '/jKBjeXM7iBBV9UkUcOXx3m7FSHY.jpg',
    release_date: '1992-06-19',
    title: 'Batman Returns',
    tmdb_id: 364,
    vote_average: 6.9
  }
]
const PLAYWRIGHT_DETAILS = new Map<number, MovieDetailData>([
  [
    155,
    {
      backdropPath: '/hqkIcbrOHL86UncnHIsHVcVmzue.jpg',
      budget: 185_000_000,
      genres: [
        { id: 28, name: 'Action' },
        { id: 80, name: 'Crime' }
      ],
      originalTitle: 'The Dark Knight',
      overview: 'Batman raises the stakes in his war on crime.',
      posterPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
      releaseDate: '2008-07-18',
      revenue: 1_006_000_000,
      runtime: 152,
      tagline: 'Why so serious?',
      title: 'The Dark Knight',
      tmdbId: 155,
      voteAverage: 8.5,
      voteCount: 33_000
    }
  ],
  [
    550,
    {
      backdropPath: '/fCayJrkfRaCRCTh8GqN30f8oyQF.jpg',
      budget: 63_000_000,
      genres: [
        { id: 18, name: 'Drama' },
        { id: 53, name: 'Thriller' }
      ],
      originalTitle: 'Fight Club',
      overview: 'An insomniac office worker crosses paths with a soap maker.',
      posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
      releaseDate: '1999-10-15',
      revenue: 101_200_000,
      runtime: 139,
      tagline: 'Mischief. Mayhem. Soap.',
      title: 'Fight Club',
      tmdbId: 550,
      voteAverage: 8.4,
      voteCount: 28_000
    }
  ],
  [
    680,
    {
      backdropPath: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
      budget: 8_000_000,
      genres: [
        { id: 80, name: 'Crime' },
        { id: 53, name: 'Thriller' }
      ],
      originalTitle: 'Pulp Fiction',
      overview: 'The lives of two mob hitmen intertwine in Los Angeles.',
      posterPath: '/vQWk5YBFWF4bZaofAbv0tShwBvQ.jpg',
      releaseDate: '1994-09-10',
      revenue: 213_900_000,
      runtime: 154,
      tagline: 'Just because you are a character does not mean you have character.',
      title: 'Pulp Fiction',
      tmdbId: 680,
      voteAverage: 8.5,
      voteCount: 30_000
    }
  ],
  [
    27_205,
    {
      backdropPath: '/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
      budget: 160_000_000,
      genres: [
        { id: 28, name: 'Action' },
        { id: 878, name: 'Science Fiction' }
      ],
      originalTitle: 'Inception',
      overview: 'A thief steals information by infiltrating dreams.',
      posterPath: '/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
      releaseDate: '2010-07-16',
      revenue: 836_800_000,
      runtime: 148,
      tagline: 'Your mind is the scene of the crime.',
      title: 'Inception',
      tmdbId: 27_205,
      voteAverage: 8.4,
      voteCount: 37_000
    }
  ]
])
const requireApiKey = (): string => {
  const k = process.env.TMDB_KEY
  if (!k) throw new Error('Missing TMDB_KEY (server-side env var)')
  return k
}
const searchMoviesAction = async (query: string): Promise<SearchResult[]> => {
  if (isStdbTestMode()) {
    const q = query.toLowerCase()
    const rows: SearchResult[] = []
    for (const m of PLAYWRIGHT_SEARCH) if (m.title.toLowerCase().includes(q)) rows.push(m)
    return rows
  }
  const apiKey = requireApiKey()
  const url = new URL('https://api.themoviedb.org/3/search/movie')
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('query', query)
  const response = await fetch(url)
  if (!response.ok) throw new Error('Search failed')
  const payload = (await response.json()) as TmdbSearchResponse
  const rows: SearchResult[] = []
  for (const m of payload.results)
    rows.push({
      id: m.id,
      overview: m.overview,
      poster_path: m.poster_path,
      release_date: m.release_date,
      title: m.title,
      tmdb_id: m.id,
      vote_average: m.vote_average
    })
  return rows
}
const fetchMovieAction = async (id: number): Promise<MovieDetailData> => {
  if (isStdbTestMode()) {
    const local = PLAYWRIGHT_DETAILS.get(id)
    if (local) return local
    throw new Error('Movie not found in test fixtures')
  }
  const apiKey = requireApiKey()
  const tmdb = new TMDB(apiKey)
  const p = await tmdb.movies.details({ movie_id: id })
  return {
    backdropPath: p.backdrop_path ?? undefined,
    budget: p.budget || undefined,
    genres: p.genres,
    originalTitle: p.original_title,
    overview: p.overview ?? '',
    posterPath: p.poster_path ?? undefined,
    releaseDate: p.release_date,
    revenue: p.revenue || undefined,
    runtime: p.runtime ?? undefined,
    tagline: p.tagline ?? undefined,
    title: p.title,
    tmdbId: p.id,
    voteAverage: p.vote_average,
    voteCount: p.vote_count
  }
}
export { fetchMovieAction, searchMoviesAction }
