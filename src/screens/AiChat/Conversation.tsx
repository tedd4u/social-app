import {useCallback, useEffect, useRef, useState} from 'react'
import {
  FlatList,
  type NativeSyntheticEvent,
  Pressable,
  TextInput,
  type TextInputSubmitEditingEventData,
  View,
} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {
  type ChatMessage,
  configureBskyStats,
  deleteChatHistory,
  fetchChatHistory,
  fetchPersonaStatus,
  type PersonaStatusInfo,
  sendChatMessage,
} from '#/lib/api/bsky-stats'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
  type NavigationProp,
} from '#/lib/routes/types'
import {atoms as a, useTheme, web} from '#/alf'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BSKY_STATS_BASE_URL ?? 'http://localhost:8000'
const API_KEY = process.env.EXPO_PUBLIC_BSKY_STATS_API_KEY ?? ''

type Props = NativeStackScreenProps<CommonNavigatorParams, 'AiChatConversation'>

export function AiChatConversationScreen({route}: Props) {
  const handle = route.params.handle
  const t = useTheme()
  const {t: lingui} = useLingui()
  const _navigation = useNavigation<NavigationProp>()
  const flatListRef = useRef<FlatList>(null)

  const [persona, setPersona] = useState<PersonaStatusInfo | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [contextPostsUsed, setContextPostsUsed] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  // Ensure API client is configured
  useEffect(() => {
    configureBskyStats(BACKEND_URL, API_KEY)
  }, [])

  // Load persona status + chat history on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [status, history] = await Promise.all([
          fetchPersonaStatus(handle),
          fetchChatHistory(handle),
        ])
        if (cancelled) return
        setPersona(status)
        setMessages(history.messages)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [handle])

  // Poll persona status while it's still loading posts
  useEffect(() => {
    if (!persona || persona.status !== 'loading') return

    const interval = setInterval(() => {
      void (async () => {
        try {
          const status = await fetchPersonaStatus(handle)
          setPersona(status)
        } catch {
          // Ignore transient poll errors
        }
      })()
    }, 1500)

    return () => clearInterval(interval)
  }, [handle, persona?.status])

  const personaReady = persona?.status === 'ready'

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 || streaming) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({animated: true})
      }, 100)
    }
  }, [messages.length, streaming, streamText])

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleSend = useCallback(() => {
    const text = inputText.trim()
    if (!text || streaming) return

    // Add user message to local state immediately
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInputText('')
    setStreaming(true)
    setStreamText('')
    setError(null)

    const controller = sendChatMessage(handle, text, {
      onToken: (token: string) => {
        setStreamText(prev => prev + token)
      },
      onDone: (fullText: string, postsUsed: number) => {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: fullText,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, assistantMsg])
        setContextPostsUsed(postsUsed)
        setStreaming(false)
        setStreamText('')
      },
      onError: (errMsg: string) => {
        setError(errMsg)
        setStreaming(false)
        setStreamText('')
      },
    })

    abortRef.current = controller
  }, [inputText, streaming, handle])

  const handleSubmitEditing = useCallback(
    (_e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
      handleSend()
    },
    [handleSend],
  )

  const handleClearChat = useCallback(() => {
    void (async () => {
      try {
        await deleteChatHistory(handle)
        setMessages([])
        setContextPostsUsed(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
  }, [handle])

  const displayName = persona?.display_name ?? handle

  // Build data for FlatList: messages + optional streaming bubble
  const listData: Array<ChatMessage | {role: 'streaming'; content: string}> = [
    ...messages,
    ...(streaming ? [{role: 'streaming' as const, content: streamText}] : []),
  ]

  if (loading) {
    return (
      <Layout.Screen testID="aiChatConversationScreen">
        <Layout.Header.Outer>
          <Layout.Header.BackButton />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>AI Chat</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
          <Layout.Header.Slot />
        </Layout.Header.Outer>
        <View style={[a.flex_1, a.align_center, a.justify_center]}>
          <Loader size="xl" />
        </View>
      </Layout.Screen>
    )
  }

  return (
    <Layout.Screen
      testID="aiChatConversationScreen"
      style={web([{minHeight: 0}, a.flex_1])}>
      {/* Header with persona name */}
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>AI {displayName}</Layout.Header.TitleText>
          {persona && (
            <Text style={[a.text_xs, t.atoms.text_contrast_low]}>
              {persona.status === 'loading'
                ? `Loading posts... (${persona.post_count} so far)`
                : `${persona.post_count} posts loaded`}
            </Text>
          )}
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>

      <Layout.Center style={[a.flex_1]}>
        {/* Message list */}
        <FlatList
          ref={flatListRef}
          data={listData}
          keyExtractor={(item, index) => `msg-${index}`}
          style={[a.flex_1, t.atoms.bg_contrast_25]}
          contentContainerStyle={[a.px_md, a.py_md, a.gap_sm]}
          renderItem={({item}) => <MessageBubble item={item} />}
          ListEmptyComponent={
            !personaReady ? (
              <View style={[a.py_5xl, a.align_center, a.gap_md]}>
                <Loader size="xl" />
                <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                  <Trans>Building persona profile...</Trans>
                </Text>
                <Text style={[a.text_sm, t.atoms.text_contrast_low]}>
                  {persona?.post_count ?? 0} posts fetched
                </Text>
              </View>
            ) : (
              <View style={[a.py_5xl, a.align_center]}>
                <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                  <Trans>Start a conversation with AI {displayName}</Trans>
                </Text>
              </View>
            )
          }
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({animated: false})
          }}
        />

        {/* Bottom area: only show input when persona is ready */}
        {personaReady ? (
          <>
            {/* Debug info bar */}
            <View
              style={[
                a.px_md,
                {
                  paddingVertical: 4,
                  borderTopWidth: 1,
                  borderTopColor: t.atoms.border_contrast_low.borderColor,
                  backgroundColor: t.atoms.bg.backgroundColor,
                },
              ]}>
              <Text style={[{fontSize: 10}, t.atoms.text_contrast_low]}>
                Corpus: {persona?.post_count ?? '?'} posts
                {persona?.last_corpus_update &&
                  ` | Updated: ${formatTimeSince(persona.last_corpus_update)}`}
                {contextPostsUsed != null &&
                  ` | Context: ${contextPostsUsed} posts selected`}
              </Text>
            </View>

            {/* Error banner */}
            {error && (
              <View
                style={[
                  a.px_md,
                  a.py_xs,
                  {
                    backgroundColor: '#fef2f2',
                    borderTopWidth: 1,
                    borderTopColor: '#fecaca',
                  },
                ]}>
                <Text style={[a.text_xs, {color: '#dc2626'}]}>{error}</Text>
              </View>
            )}

            {/* Input area */}
            <View
              style={[
                a.flex_row,
                a.align_center,
                a.gap_sm,
                {
                  padding: a.p_sm.padding,
                  borderTopWidth: 1,
                  borderTopColor: t.atoms.border_contrast_low.borderColor,
                  backgroundColor: t.atoms.bg.backgroundColor,
                },
              ]}>
              <View
                style={[
                  a.flex_row,
                  a.flex_1,
                  a.align_center,
                  t.atoms.bg_contrast_25,
                  {
                    borderWidth: 1,
                    borderColor: 'transparent',
                    borderRadius: 23,
                    paddingHorizontal: a.p_sm.padding - 2,
                  },
                ]}>
                <TextInput
                  style={[
                    a.flex_1,
                    a.text_md,
                    t.atoms.text,
                    {
                      backgroundColor: 'transparent',
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    },
                  ]}
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSubmitEditing}
                  placeholder={lingui`Message AI ${displayName}...`}
                  placeholderTextColor={t.atoms.text_contrast_low.color}
                  returnKeyType="send"
                  editable={!streaming}
                  multiline={false}
                  accessibilityLabel={lingui`Message input`}
                  accessibilityHint={lingui`Type a message to send to AI ${displayName}`}
                />
              </View>
              <Pressable
                onPress={handleSend}
                disabled={!inputText.trim() || streaming}
                style={[
                  a.align_center,
                  a.justify_center,
                  {
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor:
                      inputText.trim() && !streaming ? '#0085ff' : '#94a3b8',
                  },
                ]}
                accessibilityLabel={lingui`Send message`}
                accessibilityHint={lingui`Sends your message`}
                accessibilityRole="button">
                <Text
                  style={[{color: '#fff', fontSize: 16, fontWeight: '700'}]}>
                  {'↑'}
                </Text>
              </Pressable>
            </View>

            {/* Clear chat button */}
            {messages.length > 0 && !streaming && (
              <View
                style={[
                  a.px_md,
                  a.pb_sm,
                  {backgroundColor: t.atoms.bg.backgroundColor},
                ]}>
                <Pressable
                  onPress={handleClearChat}
                  style={[a.py_xs, a.align_center]}
                  accessibilityLabel={lingui`Clear conversation`}
                  accessibilityHint={lingui`Deletes all messages in this conversation`}
                  accessibilityRole="button">
                  <Text style={[a.text_xs, t.atoms.text_contrast_low]}>
                    <Trans>Clear conversation</Trans>
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          persona?.status === 'error' && (
            <View
              style={[
                a.px_md,
                a.py_sm,
                a.align_center,
                {
                  borderTopWidth: 1,
                  borderTopColor: t.atoms.border_contrast_low.borderColor,
                  backgroundColor: t.atoms.bg.backgroundColor,
                },
              ]}>
              <Text style={[a.text_sm, {color: '#dc2626'}]}>
                <Trans>Failed to build persona profile</Trans>
              </Text>
            </View>
          )
        )}
      </Layout.Center>
    </Layout.Screen>
  )
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({
  item,
}: {
  item: ChatMessage | {role: 'streaming'; content: string}
}) {
  const t = useTheme()
  const isSent = item.role === 'user'
  const isStreaming = item.role === 'streaming'

  return (
    <View
      style={[
        {
          maxWidth: '80%',
          alignSelf: isSent ? 'flex-end' : 'flex-start',
          backgroundColor: isSent ? '#0085ff' : t.atoms.bg.backgroundColor,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 18,
          ...(isSent
            ? {borderBottomRightRadius: 4}
            : {borderBottomLeftRadius: 4}),
          ...(!isSent && {
            shadowColor: '#000',
            shadowOffset: {width: 0, height: 1},
            shadowOpacity: 0.08,
            shadowRadius: 2,
            elevation: 1,
          }),
        },
      ]}>
      <Text
        style={[
          a.text_md,
          {lineHeight: 21, color: isSent ? '#fff' : t.atoms.text.color},
        ]}>
        {item.content || (isStreaming ? '' : '')}
      </Text>
      {isStreaming && !item.content && <TypingIndicator />}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Typing indicator (three animated dots)
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <View style={[a.flex_row, a.gap_xs, {paddingVertical: 2}]}>
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#999',
        }}
      />
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#bbb',
        }}
      />
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#ddd',
        }}
      />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeSince(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
