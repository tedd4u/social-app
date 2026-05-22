import {Pressable, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type TopItem} from '#/lib/api/bsky-stats'
import {type NavigationProp} from '#/lib/routes/types'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/**
 * Extract rkey from an AT URI: at://did:plc:xxx/app.bsky.feed.post/rkey
 */
function parseAtUri(uri: string): {name: string; rkey: string} | null {
  const parts = uri.split('/')
  if (parts.length < 5) return null
  return {name: parts[2], rkey: parts[4]}
}

export function TopList({
  title,
  items,
  countLabel,
}: {
  title: string
  items: TopItem[]
  countLabel: string
}) {
  const t = useTheme()
  const {t: lingui} = useLingui()
  const navigation = useNavigation<NavigationProp>()

  return (
    <View
      style={[a.rounded_sm, t.atoms.bg_contrast_25, a.p_md, a.gap_sm]}
      accessibilityLabel={lingui`${title} list`}
      accessibilityHint=""
      accessibilityRole="list">
      <Text style={[a.text_sm, a.font_bold, t.atoms.text]}>{title}</Text>

      {items.slice(0, 5).map((item, i) => {
        const parsed = parseAtUri(item.uri)
        return (
          <Pressable
            key={item.uri}
            onPress={() => {
              if (parsed) {
                navigation.push('PostThread', parsed)
              }
            }}
            style={[
              a.flex_row,
              a.gap_sm,
              a.py_xs,
              i < items.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: t.atoms.border_contrast_low.borderColor,
              },
            ]}
            accessibilityLabel={lingui`Post with ${item.count} ${countLabel}`}
            accessibilityHint={lingui`Opens post thread`}
            accessibilityRole="button">
            {/* Rank */}
            <Text
              style={[
                a.text_sm,
                a.font_bold,
                t.atoms.text_contrast_low,
                {width: 20},
              ]}>
              {i + 1}
            </Text>

            {/* Text preview */}
            <View style={[a.flex_1]}>
              <Text numberOfLines={2} style={[a.text_sm, t.atoms.text]}>
                {item.text || '(no text)'}
              </Text>
            </View>

            {/* Count */}
            <View style={[a.align_end]}>
              <Text style={[a.text_sm, a.font_bold, t.atoms.text]}>
                {item.count}
              </Text>
              <Text style={[a.text_xs, t.atoms.text_contrast_low]}>
                {countLabel}
              </Text>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}
