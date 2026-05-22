import {useCallback, useEffect, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useQueryClient} from '@tanstack/react-query'

import {
  configureBskyStats,
  type StatsSnapshot,
  type WindowStats,
} from '#/lib/api/bsky-stats'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {useStatsStream} from '#/state/queries/bsky-stats'
import {LanguageBreakdown} from '#/screens/BskyStats/components/LanguageBreakdown'
import {StatCard} from '#/screens/BskyStats/components/StatCard'
import {TopList} from '#/screens/BskyStats/components/TopList'
import {VelocityChart} from '#/screens/BskyStats/components/VelocityChart'
import {WindowTabs} from '#/screens/BskyStats/components/WindowTabs'
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BSKY_STATS_BASE_URL ?? 'http://localhost:8000'
const API_KEY = process.env.EXPO_PUBLIC_BSKY_STATS_API_KEY ?? ''

type Props = NativeStackScreenProps<CommonNavigatorParams, 'BskyStats'>

export function BskyStatsScreen({}: Props) {
  const t = useTheme()
  const {t: lingui} = useLingui()
  const [selectedWindow, setSelectedWindow] = useState(60)
  const [snapshot, setSnapshot] = useState<StatsSnapshot | null>(null)
  const queryClient = useQueryClient()

  // Initialise the API client
  useEffect(() => {
    configureBskyStats(BACKEND_URL, API_KEY)
  }, [])

  // Subscribe to the live stats stream (writes to query cache via setQueryData)
  const {close} = useStatsStream(API_KEY, true)

  // Listen for stream data arriving in the query cache
  useEffect(() => {
    const unsub = queryClient.getQueryCache().subscribe(event => {
      const key = event?.query?.queryKey as string[] | undefined
      if (key?.[0] === 'bsky-stats' && key?.[1] === 'stream') {
        const data = event.query.state.data as StatsSnapshot | undefined
        if (data) {
          setSnapshot(data)
        }
      }
    })
    return unsub
  }, [queryClient])

  const connected = !!snapshot

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => close()
  }, [close])

  const windowStats: WindowStats | null =
    snapshot?.windows?.[String(selectedWindow)] ?? null

  const handleWindowChange = useCallback((w: number) => {
    setSelectedWindow(w)
  }, [])

  const availableWindows = snapshot
    ? Object.keys(snapshot.windows)
        .map(Number)
        .sort((x, y) => x - y)
    : [60, 300, 600]

  return (
    <Layout.Screen testID="bskyStatsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Network Stats</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>

      <Layout.Content contentContainerStyle={[a.px_lg, a.py_md, a.gap_lg]}>
        {/* Connection indicator */}
        <View style={[a.flex_row, a.align_center, a.gap_xs]}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: connected
                ? '#22c55e'
                : t.atoms.text_contrast_low.color,
            }}
            accessibilityLabel={
              connected
                ? lingui`Connected to live stream`
                : lingui`Connecting to live stream`
            }
            accessibilityHint=""
          />
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {connected ? <Trans>Live</Trans> : <Trans>Connecting...</Trans>}
          </Text>
          {connected && snapshot && (
            <Text style={[a.text_xs, t.atoms.text_contrast_low]}>
              {new Date(snapshot.timestamp).toLocaleTimeString()}
            </Text>
          )}
        </View>

        {/* Window selector */}
        <WindowTabs
          windows={availableWindows}
          selected={selectedWindow}
          onSelect={handleWindowChange}
        />

        {!connected ? (
          <View style={[a.flex_1, a.align_center, a.justify_center, a.py_5xl]}>
            <Loader size="xl" />
            <Text style={[a.mt_md, t.atoms.text_contrast_medium]}>
              <Trans>Connecting to firehose...</Trans>
            </Text>
          </View>
        ) : windowStats ? (
          <>
            {/* Metric cards */}
            <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
              <StatCard
                label={lingui`Posts`}
                value={windowStats.metrics.post_count}
                delta={windowStats.deltas?.post_count}
              />
              <StatCard
                label={lingui`Unique Posters`}
                value={windowStats.metrics.user_count}
                delta={windowStats.deltas?.user_count}
              />
              <StatCard
                label={lingui`Likes`}
                value={windowStats.metrics.like_count}
                delta={windowStats.deltas?.like_count}
              />
              <StatCard
                label={lingui`Reposts`}
                value={windowStats.metrics.repost_count}
                delta={windowStats.deltas?.repost_count}
              />
              <StatCard
                label={lingui`Replies`}
                value={windowStats.metrics.reply_count}
                delta={windowStats.deltas?.reply_count}
              />
            </View>

            {/* Velocity sparkline */}
            {snapshot?.velocity && (
              <VelocityChart
                current={snapshot.velocity.current}
                history={snapshot.velocity.history}
                windowSeconds={selectedWindow}
              />
            )}

            {/* Language breakdown */}
            {windowStats.language_breakdown &&
              Object.keys(windowStats.language_breakdown).length > 0 && (
                <LanguageBreakdown data={windowStats.language_breakdown} />
              )}

            {/* Top lists */}
            {windowStats.top_liked.length > 0 && (
              <TopList
                title={lingui`Most Liked`}
                items={windowStats.top_liked}
                countLabel={lingui`likes`}
              />
            )}
            {windowStats.top_reposted.length > 0 && (
              <TopList
                title={lingui`Most Reposted`}
                items={windowStats.top_reposted}
                countLabel={lingui`reposts`}
              />
            )}
          </>
        ) : (
          <View style={[a.py_2xl, a.align_center]}>
            <Text style={[t.atoms.text_contrast_medium]}>
              <Trans>No data for this window yet</Trans>
            </Text>
          </View>
        )}
      </Layout.Content>
    </Layout.Screen>
  )
}
