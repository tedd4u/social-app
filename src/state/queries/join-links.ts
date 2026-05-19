import {AtpAgent} from '@atproto/api'
import {useQuery} from '@tanstack/react-query'

import {CHAT_SERVICE} from '#/lib/constants'
import {logger} from '#/logger'
import {STALE} from '#/state/queries/index'
import {createQueryKey} from '#/state/queries/util'

const joinLinkPreviewQueryKeyRoot = 'join-link-preview'

export const createJoinLinkPreviewQueryKey = (args: {code: string}) =>
  createQueryKey(joinLinkPreviewQueryKeyRoot, args, {
    persistedVersion: 1,
  })

export function useJoinLinkPreviewQuery({code}: {code?: string}) {
  const agent = new AtpAgent({service: CHAT_SERVICE})

  return useQuery({
    queryKey: createJoinLinkPreviewQueryKey({code: code ?? ''}),
    queryFn: async () => {
      if (!code) throw new Error('No invite code')
      try {
        const res = await agent.chat.bsky.group.getJoinLinkPreview({code})
        return res.data
      } catch (error) {
        logger.error('Failed to fetch join link preview', {safeMessage: error})
        throw error
      }
    },
    enabled: Boolean(code),
    staleTime: STALE.SECONDS.FIFTEEN,
  })
}
