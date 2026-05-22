import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/**
 * Simple bar-chart sparkline rendered with Views.
 * Each bar represents a velocity bucket (posts/sec).
 * No external charting library needed.
 */
export function VelocityChart({
  current,
  history,
}: {
  current: number
  history: number[]
}) {
  const t = useTheme()
  const {t: lingui} = useLingui()

  // Use last 60 data points (2 minutes at 2s intervals) for a compact sparkline
  const data = history.slice(-60)
  const max = Math.max(...data, 1)

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
              height: Math.max((val / max) * 48, 1),
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
