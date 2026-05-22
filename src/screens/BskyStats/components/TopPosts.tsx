import {useCallback, useState} from 'react'
import {Pressable, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
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

type Tab = 'liked' | 'reposted'

export function TopPosts({
  topLiked,
  topReposted,
}: {
  topLiked: TopItem[]
  topReposted: TopItem[]
}) {
  const t = useTheme()
  const {t: lingui} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const [activeTab, setActiveTab] = useState<Tab>('liked')
  const [showAll, setShowAll] = useState(false)

  const items = activeTab === 'liked' ? topLiked : topReposted
  const countLabel = activeTab === 'liked' ? lingui`likes` : lingui`reposts`
  const visible = showAll ? items : items.slice(0, 5)

  const handleTabChange = useCallback(
    (tab: Tab) => {
      setActiveTab(tab)
      setShowAll(false)
    },
    [setActiveTab, setShowAll],
  )

  return (
    <View
      style={[a.rounded_sm, t.atoms.bg_contrast_25, a.p_md, a.gap_sm]}
      accessibilityLabel={lingui`Top posts`}
      accessibilityHint=""
      accessibilityRole="list">
      {/* Segment control */}
      <View
        style={[a.flex_row, a.rounded_sm, t.atoms.bg_contrast_50, {padding: 2}]}
        accessibilityRole="tablist"
        accessibilityLabel={lingui`Top posts filter`}
        accessibilityHint="">
        <Pressable
          onPress={() => handleTabChange('liked')}
          accessibilityRole="tab"
          accessibilityState={{selected: activeTab === 'liked'}}
          accessibilityLabel={lingui`Top Liked`}
          accessibilityHint={lingui`Show most liked posts`}
          style={[
            a.flex_1,
            a.align_center,
            a.py_xs,
            a.rounded_xs,
            activeTab === 'liked' && t.atoms.bg,
          ]}>
          <Text
            style={[
              a.text_sm,
              a.font_bold,
              activeTab === 'liked'
                ? t.atoms.text
                : t.atoms.text_contrast_medium,
            ]}>
            <Trans>Top Liked</Trans>
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handleTabChange('reposted')}
          accessibilityRole="tab"
          accessibilityState={{selected: activeTab === 'reposted'}}
          accessibilityLabel={lingui`Top Reposted`}
          accessibilityHint={lingui`Show most reposted posts`}
          style={[
            a.flex_1,
            a.align_center,
            a.py_xs,
            a.rounded_xs,
            activeTab === 'reposted' && t.atoms.bg,
          ]}>
          <Text
            style={[
              a.text_sm,
              a.font_bold,
              activeTab === 'reposted'
                ? t.atoms.text
                : t.atoms.text_contrast_medium,
            ]}>
            <Trans>Top Reposted</Trans>
          </Text>
        </Pressable>
      </View>

      {/* List */}
      {visible.length === 0 ? (
        <View style={[a.py_lg, a.align_center]}>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>No data yet</Trans>
          </Text>
        </View>
      ) : (
        <>
          {visible.map((item, i) => {
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
                  i < visible.length - 1 && {
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

          {/* Show more button */}
          {!showAll && items.length > 5 && (
            <Pressable
              onPress={() => setShowAll(true)}
              style={[
                a.mt_xs,
                a.py_sm,
                a.align_center,
                a.rounded_sm,
                t.atoms.bg_contrast_50,
              ]}
              accessibilityLabel={lingui`Show more posts`}
              accessibilityHint={lingui`Expands the list to show all posts`}
              accessibilityRole="button">
              <Text
                style={[a.text_sm, a.font_bold, t.atoms.text_contrast_medium]}>
                <Trans>Show more</Trans>
              </Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  )
}
