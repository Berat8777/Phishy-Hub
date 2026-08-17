import { Pressable, StyleSheet, Text, View } from 'react-native';
import { channelDisplayName, relativeTime } from '../utils/format';
import { colors, fontFamily, fontSize, radii, spacing } from '../theme/theme';
import type { ChannelListItemDTO } from '../api/types';

export function ChannelListItem({ channel, onPress }: { channel: ChannelListItemDTO; onPress: () => void }) {
  const name = channelDisplayName(channel);
  const hasUnread = channel.unreadCount > 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{channel.type === 'dm' ? '💬' : '#'}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
            {name}
          </Text>
          {channel.lastMessage ? (
            <Text style={styles.time}>{relativeTime(channel.lastMessage.createdAt)}</Text>
          ) : null}
        </View>
        <View style={styles.bottomLine}>
          <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
            {channel.lastMessage?.body ?? 'No messages yet'}
          </Text>
          {hasUnread ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{channel.unreadCount > 99 ? '99+' : channel.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surfaceRaised,
  },
  rowPressed: { backgroundColor: colors.surfaceHover },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  avatarText: { fontSize: fontSize.lg },
  body: { flex: 1 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontFamily: fontFamily.semibold, fontSize: fontSize.md, color: colors.textDefault, flexShrink: 1 },
  nameUnread: { color: colors.textDefault },
  time: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.textSubtle, marginLeft: spacing[2] },
  bottomLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  preview: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.textMuted, flex: 1 },
  previewUnread: { color: colors.textDefault, fontFamily: fontFamily.medium },
  badge: {
    backgroundColor: colors.cta,
    borderRadius: radii.full,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing[2],
  },
  badgeText: { color: colors.textOnAccent, fontSize: fontSize.xs, fontFamily: fontFamily.semibold },
});
