import { provide, inject } from 'vue'
import {
  ApolloClient,
  InMemoryCache,
  NormalizedCacheObject,
  from,
  HttpLink,
  OperationVariables,
  ApolloQueryResult,
  QueryOptions,
  MutationOptions,
  FetchResult,
  DocumentNode,
  gql,
  disableFragmentWarnings,
} from '@apollo/client/core'
import { filter } from 'graphql-anywhere'

import { withScalars } from 'apollo-link-scalars'
import {
  buildClientSchema,
  DefinitionNode,
  ExecutableDefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
  IntrospectionQuery,
  OperationDefinitionNode,
} from 'graphql'
import jsonSchema from './__generated__/graphql.schema.json'
import generatedIntrospection from './__generated__/graphql.fragment'

import * as schema from './__generated__/graphql'
export { schema }

export { gql } from '@apollo/client/core'

const clientSymbol = Symbol('GraphQL Client Symbol')
disableFragmentWarnings()

export function createApollo(): ApolloClient<NormalizedCacheObject> {
  const typesMap = {
    DateTimeUtc: {
      serialize: (parsed: Date) => parsed.toISOString(),
      parseValue: (raw: string | null): Date | null => (raw ? new Date(raw) : null),
    },
    ObjectId: {
      serialize: (parsed: string) => parsed,
      parseValue: (raw: string | null): string | null => raw,
    },
  }
  const link = from([
    // Backend Server
    withScalars({
      schema: buildClientSchema((jsonSchema as unknown) as IntrospectionQuery),
      typesMap,
    }),
    new HttpLink({ uri: 'http://localhost:8080/graphql' }),
  ])
  const cache = new InMemoryCache({
    possibleTypes: generatedIntrospection.possibleTypes,
  })
  const client = new ApolloClient({
    link,
    cache,
  })
  return client
}

export function provideClient(client: ApolloClient<NormalizedCacheObject>): void {
  provide(clientSymbol, client)
}

export function injectClient(): ApolloClient<NormalizedCacheObject> {
  const client = inject<ApolloClient<NormalizedCacheObject>>(clientSymbol)
  return client || createApollo()
}

export function useApollo(): ApolloClient<NormalizedCacheObject> {
  const client = injectClient()
  return client
}

export function useQuery(
  options: QueryOptions<schema.Query, OperationVariables>
): Promise<ApolloQueryResult<schema.Query>> {
  const client = injectClient()
  return client.query<schema.Query>(options)
}

export function useMutate(
  options: MutationOptions<schema.Mutation, OperationVariables>
): Promise<FetchResult<schema.Mutation>> {
  const client = injectClient()
  return client.mutate<schema.Mutation>(options)
}

type QueryChildren = Record<string, BuiltFragment>

type GQLVariables = Record<string, unknown>

export type GQLFragment<QueryChildrenOptions> = {
  query: (children: QueryChildrenOptions) => DocumentNode
  queryVariables?: GQLVariables | (() => Promise<GQLVariables>)
  queryChildren?: QueryChildrenOptions
}

export type BuiltFragment = {
  query: DocumentNode
  queryVariables: () => Promise<GQLVariables>
  onQueryResult<T = unknown>(callback: (data: T) => void): void
  handleQueryResult(data: unknown): void
}

export function defineFragment<QueryChildrenOptions extends Readonly<QueryChildren> = QueryChildren>(
  frag: GQLFragment<QueryChildrenOptions>
): BuiltFragment {
  let _data: unknown
  const onQueryResultArray: ((data: unknown) => void)[] = []
  const builtFrag = {
    query: frag.query(frag.queryChildren || ({} as QueryChildrenOptions)),
    queryVariables: async () => {
      const queryVariables = {}
      if (frag.queryChildren)
        for (const childName in frag.queryChildren) {
          const child = frag.queryChildren[childName]
          Object.assign(queryVariables, await child.queryVariables())
        }
      Object.assign(
        queryVariables,
        (typeof frag.queryVariables === 'function' ? await frag.queryVariables() : frag.queryVariables) || {}
      )
      return queryVariables
    },
    handleQueryResult(data: unknown) {
      _data = data
      if (onQueryResultArray.length > 0)
        onQueryResultArray.forEach((callback) => {
          if (callback) callback(data)
        })
      const childf: Record<string, string[]> = {}
      // get fragments that children defined
      // { child: ['childFrag'] }
      for (const child in frag.queryChildren) {
        childf[child] = getDefFrags(frag.queryChildren[child].query)
      }
      // get fragments that frag defineds
      // ['frag']
      const defs = getDefFrags(builtFrag.query).filter(
        (v) =>
          !Object.values(childf)
            .map((m) => m.includes(v))
            .reduce((m, i) => i || m, false)
      )
      // get fragment link that frag uses
      // { childFrag: 'foo.bar' }
      const ufs = getUsedFrags(nodeFilter(builtFrag.query, defs))
      const cd: Record<string, string> = {}
      // link children to fragment link
      // { child: 'foo.bar' }
      for (const c in childf) {
        cd[c] = ufs[childf[c][0]]
      }
      // call children with data
      // data['foo.bar']
      for (const child in frag.queryChildren) {
        frag.queryChildren[child].handleQueryResult(
          cd[child] !== '' && (data as Record<string, unknown>)[cd[child]]
            ? (data as Record<string, unknown>)[cd[child]]
            : data
        )
      }
    },
    onQueryResult<T>(callback: (data: T) => void) {
      if (!_data) {
        onQueryResultArray.push(callback as (data: unknown) => void)
      } else {
        callback(_data as T)
      }
    },
  }
  return builtFrag
}

function nodeFilter(q: DocumentNode, names: string[]) {
  const defs: FragmentDefinitionNode | ExecutableDefinitionNode[] = []
  for (const i of q.definitions) {
    if ((i.kind === 'FragmentDefinition' || i.kind === 'OperationDefinition') && i.name && names.includes(i.name.value))
      defs.push(i)
  }
  return defs
}

function getUsedFrags(defs: readonly DefinitionNode[]) {
  const frags: Record<string, string> = {}
  for (const def of defs) {
    if (def.kind === 'FragmentDefinition' || def.kind === 'OperationDefinition') {
      const filter = (def: FragmentDefinitionNode | OperationDefinitionNode | FieldNode, path: string) => {
        if (def.selectionSet)
          for (const sel of def.selectionSet.selections) {
            switch (sel.kind) {
              case 'Field':
                filter(sel, (path ? path + '.' : '') + sel.name.value)
                break
              case 'FragmentSpread':
                frags[sel.name.value] = path
                break
            }
          }
      }
      filter(def, '')
    }
  }
  return frags
}

function getDefFrags(doc: DocumentNode) {
  const frags: string[] = []
  for (const def of doc.definitions) {
    if ((def.kind === 'FragmentDefinition' || def.kind === 'OperationDefinition') && def.name) {
      frags.push(def.name.value)
    }
  }
  return frags
}

export function createGraphQLRoot(client: ApolloClient<NormalizedCacheObject>) {
  return async (frag: BuiltFragment): Promise<void> => {
    const rootQueryFrag = defineFragment({
      query({ frag }) {
        return gql`
          query rootQuery {
            ...RootFrag
          }
          ${frag.query}
        `
      },
      queryChildren: { frag },
    })
    const result = await client.query<schema.Query>({
      query: rootQueryFrag.query,
      variables: rootQueryFrag.queryVariables,
    })
    rootQueryFrag.handleQueryResult(filter(rootQueryFrag.query, result.data))
  }
}
