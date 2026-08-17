import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { timeOfDay } from '../utils/format';
import { colors, fontFamily, fontSize, radii, spacing } from '../theme/theme';
import * as filesApi from '../api/endpoints/files';
import type { ClientMessage } from '../hooks/useChannelMessages';

export function MessageBubble({ message, isOwn }: { message: ClientMessage; isOwn: boolean }) {
  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {!isOwn ? (
          <Text style={styles.sender}>
            {message.sender ? `${message.sender.firstName} ${message.sender.lastName}` : 'Unknown'}
          </Text>
        ) : null}

        {message.attachments.map((att) => (
          <View key={att.fileId} style={styles.attachment}>
            {att.mimeType.startsWith('image/') ? (
              <ImageAttachment fileId={att.fileId} />
            ) : (
              <Text style={[styles.body, isOwn && styles.bodyOwn]} numberOfLines={1}>
                📎 {att.originalName}
              </Text>
            )}
          </View>
        ))}

        {message.body ? <Text style={[styles.body, isOwn && styles.bodyOwn]}>{message.body}</Text> : null}

        <View style={styles.metaRow}>
          {message.editedAt ? <Text style={[styles.meta, isOwn && styles.metaOwn]}>edited · </Text> : null}
          <Text style={[styles.meta, isOwn && styles.metaOwn]}>{timeOfDay(message.createdAt)}</Text>
          {message.status === 'sending' ? (
            <ActivityIndicator size="small" color={isOwn ? colors.textOnAccent : colors.textMuted} style={styles.spinner} />
          ) : null}
          {message.status === 'failed' ? <Text style={styles.failed}> · failed</Text> : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Fetches a short-lived presigned URL on demand (CONTRACT.md §3.7 —
 * `GET /files/:id`, no persistent public URL exists). Deliberately simple
 * (no caching layer) for this pass's scope.
 */
function ImageAttachment({ fileId }: { fileId: string }) {
  return (
    <View style={styles.imagePlaceholder}>
      <RemoteImage fileId={fileId} />
    </View>
  );
}

function RemoteImage({ fileId }: { fileId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    filesApi
      .getDownloadUrl(fileId, 'thumbnail')
      .catch(() => filesApi.getDownloadUrl(fileId))
      .then((res) => {
        if (!cancelled) setUrl(res.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (!url) {
    return (
      <View style={styles.imageLoading}>
        <ActivityIndicator size="small" color={colors.textMuted} />
      </View>
    );
  }
  return <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 4, paddingHorizontal: spacing[3] },
  rowOwn: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: radii.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  bubbleOwn: { backgroundColor: colors.accent, borderBottomRightRadius: radii.sm },
  bubbleOther: { backgroundColor: colors.surfaceRaised, borderBottomLeftRadius: radii.sm, borderWidth: 1, borderColor: colors.borderSubtle },
  sender: { fontFamily: fontFamily.semibold, fontSize: fontSize.xs, color: colors.accent, marginBottom: 2 },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.textDefault },
  bodyOwn: { color: colors.textOnAccent },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  meta: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.textSubtle },
  metaOwn: { color: 'rgba(255,255,255,0.75)' },
  failed: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: colors.dangerHover },
  spinner: { marginLeft: 6 },
  attachment: { marginBottom: 4 },
  imagePlaceholder: { width: 180, height: 135, borderRadius: radii.md, overflow: 'hidden' },
  imageLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSunken },
  image: { width: '100%', height: '100%' },
});
