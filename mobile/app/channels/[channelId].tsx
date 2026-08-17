import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { useChannelMessages } from '../../src/hooks/useChannelMessages';
import { MessageBubble } from '../../src/components/MessageBubble';
import { Composer } from '../../src/components/Composer';
import * as channelsApi from '../../src/api/endpoints/channels';
import { getSocket } from '../../src/socket/connection';
import { emitChannelJoin, emitChannelLeave, emitTypingStart, emitTypingStop } from '../../src/socket/emit';
import { notifyNewMessage } from '../../src/notifications/push';
import { channelDisplayName } from '../../src/utils/format';
import { colors, fontFamily, fontSize, spacing } from '../../src/theme/theme';
import type { ChannelDTO, ChannelMemberDTO } from '../../src/api/types';
import type { MessageNewEvent, MessageUpdatedEvent, MessageDeletedEvent, TypingEvent, PresenceUpdateEvent } from '../../src/socket/events';

export default function ChatScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const { status, user } = useAuth();
  const navigation = useNavigation();

  const [channel, setChannel] = useState<ChannelDTO | null>(null);
  const [members, setMembers] = useState<ChannelMemberDTO[]>([]);
  const [presence, setPresence] = useState<Map<string, 'online' | 'offline'>>(new Map());
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());

  const {
    messages,
    hasMore,
    loadingOlder,
    fetchOlder,
    sendMessage,
    receiveMessage,
    applyMessageUpdated,
    applyMessageDeleted,
    discardFailed,
  } = useChannelMessages(channelId);

  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    channelsApi.getChannel(channelId).then(setChannel).catch(() => {});
    channelsApi.listMembers(channelId).then(setMembers).catch(() => {});
  }, [channelId]);

  const title = useMemo(() => {
    if (!channel) return '…';
    const base = channelDisplayName(channel);
    if (channel.type !== 'dm') return base;
    // For DMs, surface the other member's live presence in the header —
    // this is the one visible use of `presence:update` in this screen
    // (CONTRACT.md §4.3/§4.4); other channel types don't have a single
    // "other person" to summarize presence for.
    const otherMember = members.find((m) => m.userId !== user?.id);
    const otherStatus = otherMember ? presence.get(otherMember.userId) : undefined;
    return otherStatus === 'online' ? `${base} · Online` : base;
  }, [channel, members, presence, user?.id]);

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  // Join the channel's socket room on mount, leave on unmount — the server
  // already auto-joins every channel the user is a member of on connect
  // (CONTRACT.md §4.1), but an explicit join/leave keeps this screen
  // correct even if the socket reconnected after this screen was already
  // open (e.g. after an access-token refresh cycle mid-chat).
  useEffect(() => {
    if (status !== 'authenticated') return;
    const socket = getSocket();

    void emitChannelJoin({ channelId }).catch(() => {});

    function onMessageNew(payload: MessageNewEvent) {
      if (payload.message.channelId !== channelId) return;
      receiveMessage(payload.message, payload.tempId);
      if (payload.message.senderId !== user?.id) {
        void notifyNewMessage({
          channelName: title,
          senderName: payload.message.sender ? `${payload.message.sender.firstName}` : 'New message',
          body: payload.message.body ?? '📎 Attachment',
        }).catch(() => {});
      }
    }
    function onMessageUpdated(payload: MessageUpdatedEvent) {
      if (payload.message.channelId !== channelId) return;
      applyMessageUpdated(payload.message);
    }
    function onMessageDeleted(payload: MessageDeletedEvent) {
      if (payload.channelId !== channelId) return;
      applyMessageDeleted(payload.messageId);
    }
    function onTyping(payload: TypingEvent) {
      if (payload.channelId !== channelId || payload.userId === user?.id) return;
      setTypingUserIds((prev) => {
        const next = new Set(prev);
        if (payload.isTyping) next.add(payload.userId);
        else next.delete(payload.userId);
        return next;
      });
      const timeouts = typingTimeoutsRef.current;
      const existing = timeouts.get(payload.userId);
      if (existing) clearTimeout(existing);
      if (payload.isTyping) {
        timeouts.set(
          payload.userId,
          setTimeout(() => {
            setTypingUserIds((prev) => {
              const next = new Set(prev);
              next.delete(payload.userId);
              return next;
            });
          }, 5000),
        );
      }
    }
    function onPresence(payload: PresenceUpdateEvent) {
      setPresence((prev) => new Map(prev).set(payload.userId, payload.status));
    }

    socket.on('message:new', onMessageNew);
    socket.on('message:updated', onMessageUpdated);
    socket.on('message:deleted', onMessageDeleted);
    socket.on('typing', onTyping);
    socket.on('presence:update', onPresence);

    return () => {
      socket.off('message:new', onMessageNew);
      socket.off('message:updated', onMessageUpdated);
      socket.off('message:deleted', onMessageDeleted);
      socket.off('typing', onTyping);
      socket.off('presence:update', onPresence);
      void emitChannelLeave({ channelId }).catch(() => {});
      for (const t of typingTimeoutsRef.current.values()) clearTimeout(t);
      typingTimeoutsRef.current.clear();
    };
  }, [channelId, status, user?.id, receiveMessage, applyMessageUpdated, applyMessageDeleted, title]);

  const handleSend = useCallback(
    async (input: { body?: string; fileIds?: string[] }) => {
      await sendMessage(input);
    },
    [sendMessage],
  );

  const handleTypingChange = useCallback(
    (isTyping: boolean) => {
      if (status !== 'authenticated') return;
      if (isTyping) emitTypingStart({ channelId });
      else emitTypingStop({ channelId });
    },
    [channelId, status],
  );

  const handleRetry = useCallback(
    async (tempId: string, body: string | null) => {
      discardFailed(tempId);
      await sendMessage({ body: body ?? undefined }).catch(() => {});
    },
    [discardFailed, sendMessage],
  );

  const typingLabel = useMemo(() => {
    if (typingUserIds.size === 0) return null;
    const names = Array.from(typingUserIds)
      .map((id) => members.find((m) => m.userId === id))
      .filter(Boolean).length;
    return names > 0 ? 'Typing…' : null;
  }, [typingUserIds, members]);

  // All hooks above this line unconditionally — Redirect must come after
  // every hook call so the hook count/order never changes across renders.
  if (status !== 'authenticated') return <Redirect href="/" />;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.flex}>
        <FlatList
          data={[...messages].reverse()}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onLongPress={() => {
                if (item.status === 'failed') void handleRetry(item.id, item.body);
              }}
            >
              <MessageBubble message={item} isOwn={item.senderId === user?.id} />
            </Pressable>
          )}
          onEndReached={() => {
            if (hasMore && !loadingOlder) void fetchOlder();
          }}
          onEndReachedThreshold={0.4}
          contentContainerStyle={styles.list}
        />
        {typingLabel ? (
          <View style={styles.typingRow}>
            <Text style={styles.typingText}>{typingLabel}</Text>
          </View>
        ) : null}
        <Composer onSend={handleSend} onTypingChange={handleTypingChange} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgCanvas },
  list: { paddingVertical: spacing[2] },
  typingRow: { paddingHorizontal: spacing[4], paddingBottom: 2 },
  typingText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.textSubtle, fontStyle: 'italic' },
});
