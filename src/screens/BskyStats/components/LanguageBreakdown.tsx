import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

const BAR_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f97316', // orange
  '#22c55e', // green
  '#06b6d4', // cyan
  '#eab308', // yellow
  '#ef4444', // red
  '#64748b', // slate
  '#a855f7', // purple
]

export function LanguageBreakdown({data}: {data: Record<string, number>}) {
  const t = useTheme()
  const {t: lingui} = useLingui()

  // Sort by percentage descending
  const sorted = Object.entries(data).sort(([, a], [, b]) => b - a)
  // Show top 8, group rest as "other"
  const top = sorted.slice(0, 8)
  const restSum = sorted.slice(8).reduce((sum, [, v]) => sum + v, 0)
  if (restSum > 0) {
    top.push(['other', restSum])
  }

  return (
    <View
      style={[a.rounded_sm, t.atoms.bg_contrast_25, a.p_md, a.gap_sm]}
      accessibilityLabel={lingui`Language breakdown`}
      accessibilityHint=""
      accessibilityRole="summary">
      <Text style={[a.text_sm, a.font_bold, t.atoms.text]}>
        <Trans>Languages</Trans>
      </Text>

      {/* Stacked bar */}
      <View
        style={[a.flex_row, a.rounded_full, {height: 12, overflow: 'hidden'}]}>
        {top.map(([lang, pct], i) => (
          <View
            key={lang}
            style={{
              flex: pct,
              backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
            }}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
        {top.map(([lang, pct], i) => (
          <View key={lang} style={[a.flex_row, a.align_center, a.gap_2xs]}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
              }}
            />
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              {lang.toUpperCase()} {(pct * 100).toFixed(1)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
