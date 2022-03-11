/* eslint-disable @typescript-eslint/no-explicit-any */
import { provide, inject } from 'vue'
import type { NormalizedCacheObject, FieldFunctionOptions } from '@apollo/client/core'
import { ApolloClient, InMemoryCache, from, HttpLink, disableFragmentWarnings } from '@apollo/client/core'
import type { SafeReadonly } from '@apollo/client/cache/core/types/common'
import { mergeDeep, offsetLimitPagination } from '@apollo/client/utilities'
import RawObjectID from 'bson-objectid'
import { DefaultApolloClient } from '@vue/apollo-composable'
import { logErrorMessages } from '@vue/apollo-util'

import scalarTypePolicies from './__generated__/typePolicies'
import generatedIntrospection from './__generated__/graphql.fragment'

import type * as schema from './__generated__/graphql'
export type { schema }
export type Query = schema.Query
export type Mutation = schema.Mutation
export type Subscription = schema.Subscription

export { gql } from '@apollo/client/core'

import { useQuery as vUseQuery } from '@vue/apollo-composable'
export * from '@vue/apollo-composable'

disableFragmentWarnings()

export class ObjectID extends RawObjectID {
  toJSON() {
    return this.toHexString()
  }
}

export function createApollo(): ApolloClient<NormalizedCacheObject> {
  const link = from([
    // Backend Server
    new HttpLink({
      uri: 'https://patchyvideo.com/be/gql/graphql',
      credentials: 'include',
    }),
  ])
  const childOffsetLimitPara = (tagName: string) => ({
    read(existing: SafeReadonly<any> | undefined, { args }: FieldFunctionOptions): any {
      if (!args) throw new Error('')
      return (
        existing && {
          ...existing,
          [tagName]: existing[tagName].slice(args.para.offset, args.para.offset + args.para.limit),
        }
      )
    },
    merge(
      existing: SafeReadonly<any> | undefined,
      incoming: SafeReadonly<any>,
      { args, mergeObjects }: FieldFunctionOptions
    ): any {
      return {
        ...mergeObjects(existing, incoming),
        [tagName]: (() => {
          const merged = existing ? existing[tagName].slice(0) : []
          if (args) {
            // Assume an offset of 0 if args.offset omitted.
            const { offset = 0 } = args.para
            for (let i = 0; i < incoming[tagName].length; ++i) {
              merged[offset + i] = incoming[tagName][i]
            }
          }
          return merged
        })(),
      }
    },
  })
  const selfOffsetLimitPara = () => ({
    read(existing: SafeReadonly<any> | undefined, { args }: FieldFunctionOptions): any {
      if (!args) throw new Error('')
      return existing && existing.slice(args.para.offset, args.para.offset + args.para.limit)
    },
    merge(existing: SafeReadonly<any> | undefined, incoming: SafeReadonly<any>, { args }: FieldFunctionOptions): any {
      const merged = existing ? existing.slice(0) : []
      if (args) {
        // Assume an offset of 0 if args.offset omitted.
        const { offset = 0 } = args.para
        for (let i = 0; i < incoming.length; ++i) {
          merged[offset + i] = incoming[i]
        }
      }
      return merged
    },
  })
  const cache = new InMemoryCache({
    possibleTypes: generatedIntrospection.possibleTypes,
    typePolicies: mergeDeep(scalarTypePolicies, {
      Query: {
        fields: {
          listPlaylist: {
            ...childOffsetLimitPara('playlists'),
            keyArgs: ['para', ['query', 'order', 'additionalConstraint']],
          },
          listVideo: {
            ...childOffsetLimitPara('videos'),
            keyArgs: [
              'para',
              ['query', 'qtype', 'order', 'additionalConstraint', 'hidePlaceholder', 'lang', 'humanReadableTag'],
            ],
          },
          listTagObjects: {
            ...childOffsetLimitPara('tags'),
            keyArgs: ['para', ['query', 'queryRegex', 'category', 'order']],
          },
          listNotifications: {
            ...childOffsetLimitPara('notes'),
            keyArgs: ['para', ['listAll', 'noteType']],
          },
          listSubscriptionVideos: {
            ...childOffsetLimitPara('videos'),
            keyArgs: ['para', ['query', 'queryRegex', 'category', 'order']],
          },
        },
      },
      Playlist: {
        fields: {
          videos: {
            ...offsetLimitPagination(),
          },
        },
      },
    }),
  })
  const client = new ApolloClient({
    link,
    cache,
  })
  return client
}

export function provideClient(client: ApolloClient<NormalizedCacheObject>): void {
  provide(DefaultApolloClient, client)
}

export function injectClient(): ApolloClient<NormalizedCacheObject> {
  const client = inject<ApolloClient<NormalizedCacheObject>>(DefaultApolloClient)
  return client || createApollo()
}

export function useApollo(): ApolloClient<NormalizedCacheObject> {
  const client = injectClient()
  return client
}

export const useQuery = function useQuery(this: never, ...args: never) {
  const query = vUseQuery.apply(this, args)

  // `fetchMore` doesn't automatically change loading state, but changing it makes more sense
  const fetchMore = query.fetchMore
  query.fetchMore = function (this: never, ...args: never) {
    query.loading.value = true
    const fm = fetchMore.apply(this, args)
    if (fm) {
      fm.then(() => (query.loading.value = false))
    } else {
      query.loading.value = false
    }
    return fm
  } as typeof query.fetchMore

  // force refetch new queries
  query.result.value = undefined
  query.loading.value = true
  query.restart()

  // log all errors
  query.onError((error) => {
    logErrorMessages(error)
  })

  return query
} as typeof vUseQuery
