import {useCallback, useEffect, useState} from 'react'
import {Pressable, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useFocusEffect, useNavigation} from '@react-navigation/native'

import {
  configureBskyStats,
  listPersonas,
  type PersonaInfo,
} from '#/lib/api/bsky-stats'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
  type NavigationProp,
} from '#/lib/routes/types'
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BSKY_STATS_BASE_URL ?? 'http://localhost:8000'
const API_KEY = process.env.EXPO_PUBLIC_BSKY_STATS_API_KEY ?? ''

type Props = NativeStackScreenProps<CommonNavigatorParams, 'AiChatInbox'>

export function AiChatInboxScreen({}: Props) {
  const t = useTheme()
  const {t: lingui} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const [personas, setPersonas] = useState<PersonaInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Ensure API client is configured
  useEffect(() => {
    configureBskyStats(BACKEND_URL, API_KEY)
  }, [])

  const loadPersonas = useCallback(async () => {
    try {
      setError(null)
      const result = await listPersonas()
      setPersonas(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // Reload on focus
  useFocusEffect(
    useCallback(() => {
      void loadPersonas()
    }, [loadPersonas]),
  )

  // Initial load
  useEffect(() => {
    void loadPersonas()
  }, [loadPersonas])

  return (
    <Layout.Screen testID="aiChatInboxScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>AI Chats</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>

      <Layout.Content>
        <View style={[a.px_lg, a.py_md, a.gap_md]}>
          {loading ? (
            <View
              style={[a.flex_1, a.align_center, a.justify_center, a.py_5xl]}>
              <Loader size="xl" />
            </View>
          ) : error ? (
            <View style={[a.py_5xl, a.align_center, a.gap_sm]}>
              <Text style={[t.atoms.text_contrast_medium]}>
                <Trans>Failed to load chats</Trans>
              </Text>
              <Pressable
                onPress={loadPersonas}
                accessibilityLabel={lingui`Retry`}
                accessibilityHint={lingui`Retry loading chats`}
                accessibilityRole="button">
                <Text style={[a.text_sm, {color: '#0085ff'}]}>
                  <Trans>Tap to retry</Trans>
                </Text>
              </Pressable>
            </View>
          ) : personas.length === 0 ? (
            <View style={[a.py_5xl, a.align_center, a.gap_sm]}>
              <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                <Trans>No AI chats yet</Trans>
              </Text>
              <Text style={[a.text_sm, t.atoms.text_contrast_low]}>
                <Trans>
                  Visit a profile and tap the menu to start an AI chat
                </Trans>
              </Text>
            </View>
          ) : (
            personas.map(persona => (
              <PersonaRow
                key={persona.handle}
                persona={persona}
                onPress={() => {
                  navigation.push('AiChatConversation', {
                    handle: persona.handle,
                  })
                }}
              />
            ))
          )}
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}

function PersonaRow({
  persona,
  onPress,
}: {
  persona: PersonaInfo
  onPress: () => void
}) {
  const t = useTheme()
  const {t: lingui} = useLingui()
  const isLoading = persona.status === 'loading'

  return (
    <Pressable
      onPress={onPress}
      disabled={isLoading}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.py_sm,
        a.px_sm,
        a.rounded_sm,
        {opacity: isLoading ? 0.6 : 1},
      ]}
      accessibilityLabel={lingui`Chat with AI ${persona.display_name ?? persona.handle}`}
      accessibilityHint={lingui`Opens AI chat conversation`}
      accessibilityRole="button">
      {/* Avatar placeholder */}
      <View
        style={[
          {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: t.atoms.bg_contrast_100.backgroundColor,
          },
          a.align_center,
          a.justify_center,
        ]}>
        <Text style={[a.text_lg]}>
          {(persona.display_name ?? persona.handle).charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Info */}
      <View style={[a.flex_1]}>
        <View style={[a.flex_row, a.align_center, a.gap_xs]}>
          <Text
            style={[a.text_md, a.font_bold, t.atoms.text]}
            numberOfLines={1}>
            {persona.display_name ?? persona.handle}
          </Text>
          <View
            style={[
              {
                backgroundColor: '#0085ff',
                paddingHorizontal: 5,
                paddingVertical: 1,
                borderRadius: 4,
              },
            ]}>
            <Text style={[{color: '#fff', fontSize: 9, fontWeight: '700'}]}>
              AI
            </Text>
          </View>
        </View>
        {isLoading ? (
          <Text
            style={[a.text_sm, {color: '#f59e0b', fontStyle: 'italic'}]}
            numberOfLines={1}>
            <Trans>Loading persona... ({persona.post_count} posts)</Trans>
          </Text>
        ) : (
          <Text
            style={[a.text_sm, t.atoms.text_contrast_medium]}
            numberOfLines={1}>
            @{persona.handle}
          </Text>
        )}
      </View>

      {/* Status indicator */}
      {persona.status === 'error' && (
        <View
          style={[
            {
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#ef4444',
            },
          ]}
          accessibilityLabel={lingui`Error loading persona`}
          accessibilityHint=""
        />
      )}
    </Pressable>
  )
}
