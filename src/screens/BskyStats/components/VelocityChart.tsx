import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/**
 * Simple bar-chart sparkline rendered with Views.
 * Each bar represents a velocity bucket (posts/sec).
 * No external charting library needed.
 */
const BUCKET_INTERVAL_S = 2

export function VelocityChart({
  current,
  history,
  windowSeconds = 60,
}: {
  current: number
  history: number[]
  /** Selected time window in seconds — determines how many bars to show. */
  windowSeconds?: number
}) {
  const t = useTheme()
  const {t: lingui} = useLingui()

  // Show enough data points to cover the selected window
  const barCount = Math.floor(windowSeconds / BUCKET_INTERVAL_S)
  const data = history.slice(-barCount)
  // Use the 95th-percentile value as the chart ceiling so that outlier
  // spikes (e.g. reconnection backlog flush, firehose anomalies) don't
  // compress all the normal bars into invisible slivers.  p95 works
  // well even for the 1-minute window (30 bars → top 2 clipped).
  const sorted = [...data].sort((x, y) => x - y)
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 1
  const max = Math.max(p95, 1)

  return (
    <View
      style={[a.rounded_sm, t.atoms.bg_contrast_25, a.p_md, a.gap_sm]}
      accessibilityLabel={lingui`Posting velocity: ${current.toFixed(1)} posts per second`}
      accessibilityHint=""
      accessibilityRole="image">
      <View style={[a.flex_row, a.justify_between, a.align_end]}>
        <Text style={[a.text_sm, a.font_bold, t.atoms.text]}>
          <Trans>Posting Velocity</Trans>
        </Text>
        <Text style={[a.text_lg, a.font_bold, t.atoms.text]}>
          {current.toFixed(1)}
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {' '}
            <Trans>posts/sec</Trans>
          </Text>
        </Text>
      </View>

      {/* Bar chart */}
      <View style={[a.flex_row, a.align_end, {height: 48, gap: 1}]}>
        {data.map((val, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: Math.min(Math.max((val / max) * 48, 1), 48),
              backgroundColor: t.atoms.text_contrast_low.color,
              borderRadius: 1,
              opacity: 0.6 + 0.4 * (i / data.length),
            }}
          />
        ))}
      </View>
    </View>
  )
}
