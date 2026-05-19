import {View} from 'react-native'
import {ImageBackground} from 'expo-image'
import {moderateProfile} from '@atproto/api'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {createSanitizedDisplayName} from '#/lib/moderation/create-sanitized-display-name'
import {type NavigationProp} from '#/lib/routes/types'
import {sanitizeHandle} from '#/lib/strings/handles'
import {logger} from '#/logger'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useJoinLinkPreviewQuery} from '#/state/queries/join-links'
import {useRequestJoinGroupChat} from '#/state/queries/messages/request-join-group-chat'
import {useSession} from '#/state/session'
import {useActiveGroupChatJoinRequest} from '#/state/shell/landing'
import {LoggedOutScreenState} from '#/view/com/auth/LoggedOut'
import {LogomarkWithType} from '#/view/icons/LogomarkWithType'
import {MEMBER_LIMIT} from '#/screens/Messages/ConversationSettings/constants'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {AvatarBubbles} from '#/components/AvatarBubbles'
import {Button, ButtonText} from '#/components/Button'
import {ChainLinkBroken_Stroke2_Corner0_Rounded as ChainLinkBrokenIcon} from '#/components/icons/ChainLink'
import {PersonGroup_Stroke2_Corner2_Rounded as PersonGroupIcon} from '#/components/icons/Person'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

type Props = {
  setScreenState: (state: LoggedOutScreenState) => void
}

export function JoinRequest({setScreenState}: Props) {
  const t = useTheme()
  const {t: l} = useLingui()

  const {gtMobile, gtTablet} = useBreakpoints()
  const moderationOpts = useModerationOpts()
  const {hasSession} = useSession()

  // Get code from context (logged-out only)
  const contextJoinRequest = useActiveGroupChatJoinRequest()
  const code = contextJoinRequest?.code

  const {data, error} = useJoinLinkPreviewQuery({code})

  // Lazy-load background images based on current theme and breakpoint
  const isDarkMode = t.name !== 'light'
  const background = gtMobile
    ? isDarkMode
      ? require('../../../assets/images/chat-desktop-bg-dark.webp')
      : require('../../../assets/images/chat-desktop-bg-light.webp')
    : isDarkMode
      ? require('../../../assets/images/chat-mobile-bg-dark.webp')
      : require('../../../assets/images/chat-mobile-bg-light.webp')

  return (
    <View style={[a.h_full, a.w_full, t.atoms.bg_contrast_25]}>
      <ImageBackground
        source={background}
        style={[a.h_full, a.w_full, a.flex_1, a.justify_center]}
        contentFit={gtTablet ? 'contain' : 'cover'}>
        <View style={[a.h_full, a.w_full, a.justify_center, a.align_center]}>
          {error ? (
            <Wrapper>
              <ChainLinkBrokenIcon fill={t.palette.primary_500} size="3xl" />
              <Text
                style={[
                  a.mb_sm,
                  a.text_center,
                  a.text_lg,
                  a.font_semi_bold,
                  t.atoms.text,
                ]}>
                {error.message === 'Invalid join link code'
                  ? l`This invite link has expired`
                  : error.message}
              </Text>
              {hasSession ? (
                <BackToChatButton />
              ) : setScreenState ? (
                <ActionButtons
                  hasSession={false}
                  setScreenState={setScreenState}
                />
              ) : null}
            </Wrapper>
          ) : data && moderationOpts ? (
            <Wrapper>
              <AvatarBubbles
                profiles={[
                  data.joinLinkPreview.owner,
                  ...Array(data.joinLinkPreview.memberCount - 1).fill(
                    undefined,
                  ),
                ]}
                size={135}
              />
              <View>
                <View
                  style={[
                    a.flex_row,
                    a.align_center,
                    a.justify_center,
                    a.gap_sm,
                  ]}>
                  <Text
                    style={[
                      a.text_center,
                      a.text_xs,
                      a.leading_snug,
                      t.atoms.text_contrast_medium,
                    ]}>
                    <Trans>Group chat</Trans>
                  </Text>
                  <View style={[a.flex_row]}>
                    <PersonGroupIcon
                      size="xs"
                      style={[a.mr_2xs, t.atoms.text_contrast_medium]}
                    />
                    <Text
                      style={[
                        a.text_center,
                        a.text_xs,
                        a.leading_snug,
                        t.atoms.text_contrast_medium,
                      ]}>
                      <Trans comment="The number of active group chat members out of the total number allowed.">
                        {data.joinLinkPreview.memberCount}/{MEMBER_LIMIT}
                      </Trans>
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    a.text_center,
                    a.text_4xl,
                    a.font_bold,
                    t.atoms.text,
                  ]}>
                  {data.joinLinkPreview.name}
                </Text>
              </View>
              <View>
                <Text
                  style={[
                    a.mb_2xs,
                    a.text_center,
                    a.text_sm,
                    a.font_semi_bold,
                    t.atoms.text,
                  ]}>
                  By{' '}
                  {createSanitizedDisplayName(
                    data.joinLinkPreview.owner,
                    false,
                    moderateProfile(
                      data.joinLinkPreview.owner,
                      moderationOpts,
                    ).ui('displayName'),
                  )}
                </Text>
                <Text
                  style={[
                    a.text_center,
                    a.text_2xs,
                    a.font_medium,
                    t.atoms.text_contrast_medium,
                  ]}>
                  {sanitizeHandle(data.joinLinkPreview.owner.handle, '@')}
                </Text>
              </View>
              <Text
                style={[a.text_center, a.text_sm, t.atoms.text_contrast_high]}>
                {hasSession
                  ? null
                  : data.joinLinkPreview.requireApproval
                    ? l`Sign in to request access to this group chat.`
                    : l`Sign in to accept invite.`}
              </Text>
              <ActionButtons
                hasSession={hasSession}
                setScreenState={setScreenState}
                requireApproval={data.joinLinkPreview.requireApproval}
                code={code}
              />
            </Wrapper>
          ) : null}
        </View>
      </ImageBackground>
    </View>
  )
}

function Wrapper({children}: React.PropsWithChildren<unknown>) {
  const t = useTheme()

  return (
    <>
      <LogomarkWithType
        width={136}
        fill={t.palette.primary_500}
        style={[
          a.absolute,
          {
            top: 40,
          },
        ]}
      />
      <View
        role="dialog"
        aria-modal
        style={[
          a.zoom_fade_in,
          a.align_center,
          a.gap_lg,
          a.p_2xl,
          a.pt_4xl,
          t.atoms.bg,
          t.atoms.shadow_xl,
          {
            borderRadius: 48,
            maxWidth: 320,
            width: '90%',
          },
        ]}>
        {children}
      </View>
    </>
  )
}

function ActionButtons({
  hasSession,
  setScreenState,
  requireApproval,
  code,
}: {
  hasSession: boolean
  setScreenState?: (state: LoggedOutScreenState) => void
  requireApproval?: boolean
  code?: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  const navigation = useNavigation<NavigationProp>()

  const isDarkMode = t.name !== 'light'

  const joinMutation = useRequestJoinGroupChat({
    onSuccess: data => {
      switch (data.status) {
        case 'pending':
          // User needs to wait for approval
          Toast.show(
            l`Access requested! The group owner will review your request.`,
          )
          navigation.navigate('Messages', {})
          break
        case 'joined': {
          if (data.convo?.id) {
            // Successfully joined - navigate to conversation
            Toast.show(l`Successfully joined the group chat!`)
            navigation.navigate('MessagesConversation', {
              conversation: data.convo.id,
            })
          } else {
            // Convo ID wasn't returned - shouldn't happen
            logger.warn('Request to join group chat returned no convo ID', {
              status: data.status,
              convoId: data.convo?.id,
            })
          }
          break
        }
      }
    },
    onError: () => {
      Toast.show(l`Failed to join the group chat. Please try again.`)
    },
  })

  if (!hasSession && setScreenState) {
    return (
      <>
        <Button
          testID="signInButton"
          onPress={() => {
            setScreenState(LoggedOutScreenState.S_Login)
          }}
          label={l`Sign in`}
          accessibilityHint={l`Opens flow to sign in to your existing Bluesky account`}
          size="large"
          color="primary"
          style={[a.w_full]}>
          <ButtonText>
            <Trans>Sign in</Trans>
          </ButtonText>
        </Button>
        <Button
          testID="createAccountButton"
          onPress={() => {
            setScreenState(LoggedOutScreenState.S_CreateAccount)
          }}
          label={l`Create new account`}
          accessibilityHint={l`Opens flow to create a new Bluesky account`}
          size="large"
          color={isDarkMode ? 'secondary_inverted' : 'secondary'}
          style={[a.w_full]}>
          <ButtonText>
            <Trans>Create account</Trans>
          </ButtonText>
        </Button>
      </>
    )
  }

  const buttonText = requireApproval
    ? joinMutation.isPending
      ? l`Requesting access…`
      : l`Request Access`
    : joinMutation.isPending
      ? l`Joining…`
      : l`Join`

  return (
    <Button
      testID="joinButton"
      onPress={() => {
        if (!code) return
        joinMutation.mutate({code})
      }}
      label={
        requireApproval ? l`Request access to group chat` : l`Join group chat`
      }
      accessibilityHint={
        requireApproval
          ? l`Request access to join this group chat`
          : l`Join this group chat`
      }
      size="large"
      color="primary"
      disabled={joinMutation.isPending || !code}
      style={[a.w_full]}>
      <ButtonText>{buttonText}</ButtonText>
    </Button>
  )
}

function BackToChatButton() {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()

  return (
    <Button
      testID="backToChatButton"
      onPress={() => {
        navigation.navigate('Messages', {})
      }}
      label={l`Back to chat`}
      accessibilityHint={l`Navigate back to messages`}
      size="large"
      color="primary"
      style={[a.w_full]}>
      <ButtonText>
        <Trans>Back to chat</Trans>
      </ButtonText>
    </Button>
  )
}
