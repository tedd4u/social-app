import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

export function StatCard({
  label,
  value,
  delta,
}: {
  label: string
  value: number
  delta?: number | null
}) {
  const t = useTheme()

  const formattedValue =
    value >= 1_000_000
      ? `${(value / 1_000_000).toFixed(1)}M`
      : value >= 1_000
        ? `${(value / 1_000).toFixed(1)}K`
        : String(value)

  const deltaText =
    delta != null
      ? `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`
      : null

  const deltaColor =
    delta != null && delta > 0
      ? '#22c55e'
      : delta != null && delta < 0
        ? '#ef4444'
        : t.atoms.text_contrast_low.color

  return (
    <View
      style={[
        a.rounded_sm,
        a.px_md,
        a.py_sm,
        t.atoms.bg_contrast_25,
        {minWidth: 100, flex: 1},
      ]}
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint=""
      accessibilityRole="text">
      <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>{label}</Text>
      <Text style={[a.text_2xl, a.font_bold, t.atoms.text]}>
        {formattedValue}
      </Text>
      {deltaText && (
        <Text style={[a.text_xs, {color: deltaColor}]}>{deltaText}</Text>
      )}
    </View>
  )
}
