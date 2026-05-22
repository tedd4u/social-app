import {Pressable, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

function windowLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  return `${seconds / 60}m`
}

export function WindowTabs({
  windows,
  selected,
  onSelect,
}: {
  windows: number[]
  selected: number
  onSelect: (w: number) => void
}) {
  const t = useTheme()
  const {t: lingui} = useLingui()

  return (
    <View
      style={[a.flex_row, a.gap_xs]}
      accessibilityRole="tablist"
      accessibilityLabel={lingui`Time window selector`}
      accessibilityHint="">
      {windows.map(w => {
        const isSelected = w === selected
        return (
          <Pressable
            key={w}
            onPress={() => onSelect(w)}
            accessibilityRole="tab"
            accessibilityState={{selected: isSelected}}
            accessibilityLabel={lingui`${windowLabel(w)} window`}
            accessibilityHint={lingui`Switches to ${windowLabel(w)} time window`}
            style={[
              a.px_md,
              a.py_xs,
              a.rounded_full,
              isSelected ? t.atoms.bg_contrast_100 : t.atoms.bg_contrast_25,
            ]}>
            <Text
              style={[
                a.text_sm,
                a.font_bold,
                isSelected ? t.atoms.text : t.atoms.text_contrast_medium,
              ]}>
              {windowLabel(w)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
