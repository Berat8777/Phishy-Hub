import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { captureFromCamera, pickFromGallery } from '../utils/attachments';
import * as filesApi from '../api/endpoints/files';
import { colors, fontFamily, fontSize, radii, spacing } from '../theme/theme';

interface PendingAttachment {
  fileId: string;
  name: string;
  uploading: boolean;
}

export function Composer({
  onSend,
  onTypingChange,
}: {
  onSend: (input: { body?: string; fileIds?: string[] }) => Promise<void>;
  onTypingChange: (isTyping: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const typingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChangeText(value: string) {
    setText(value);
    if (!typingRef.current) {
      typingRef.current = true;
      onTypingChange(true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingRef.current = false;
      onTypingChange(false);
    }, 2000);
  }

  async function addAttachment(pick: () => Promise<Awaited<ReturnType<typeof pickFromGallery>>>) {
    const asset = await pick();
    if (!asset) return;
    const placeholder: PendingAttachment = { fileId: `uploading-${Date.now()}`, name: asset.name, uploading: true };
    setAttachments((prev) => [...prev, placeholder]);
    try {
      const file = await filesApi.uploadFile(asset);
      setAttachments((prev) =>
        prev.map((a) => (a.fileId === placeholder.fileId ? { fileId: file.id, name: file.originalName, uploading: false } : a)),
      );
    } catch {
      setAttachments((prev) => prev.filter((a) => a.fileId !== placeholder.fileId));
    }
  }

  function removeAttachment(fileId: string) {
    setAttachments((prev) => prev.filter((a) => a.fileId !== fileId));
  }

  async function handleSend() {
    const body = text.trim();
    const readyFileIds = attachments.filter((a) => !a.uploading).map((a) => a.fileId);
    if (!body && readyFileIds.length === 0) return;
    if (attachments.some((a) => a.uploading)) return; // wait for uploads to finish

    setSending(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingRef.current = false;
    onTypingChange(false);
    try {
      await onSend({ body: body || undefined, fileIds: readyFileIds.length > 0 ? readyFileIds : undefined });
      setText('');
      setAttachments([]);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSending(false);
    }
  }

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !attachments.some((a) => a.uploading);

  return (
    <View style={styles.container}>
      {attachments.length > 0 ? (
        <View style={styles.attachmentsRow}>
          {attachments.map((a) => (
            <View key={a.fileId} style={styles.chip}>
              {a.uploading ? <ActivityIndicator size="small" color={colors.accent} /> : null}
              <Text style={styles.chipText} numberOfLines={1}>
                {a.name}
              </Text>
              <Pressable onPress={() => removeAttachment(a.fileId)} hitSlop={8}>
                <Text style={styles.chipRemove}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <Pressable style={styles.iconButton} onPress={() => void addAttachment(captureFromCamera)} hitSlop={8}>
          <Text style={styles.icon}>📷</Text>
        </Pressable>
        <Pressable style={styles.iconButton} onPress={() => void addAttachment(pickFromGallery)} hitSlop={8}>
          <Text style={styles.icon}>🖼️</Text>
        </Pressable>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleChangeText}
          placeholder="Message…"
          placeholderTextColor={colors.textSubtle}
          multiline
        />

        <Pressable
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend || sending}
        >
          {sending ? <ActivityIndicator size="small" color={colors.textOnAccent} /> : <Text style={styles.sendText}>Send</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  iconButton: { padding: spacing[2] },
  icon: { fontSize: fontSize.lg },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.textDefault,
    marginHorizontal: spacing[1],
  },
  sendButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: colors.borderStrong },
  sendText: { color: colors.textOnAccent, fontFamily: fontFamily.semibold, fontSize: fontSize.xs },
  attachmentsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSubtle,
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    maxWidth: 160,
    gap: 4,
  },
  chipText: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: colors.accentSubtleText, flexShrink: 1 },
  chipRemove: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.accentSubtleText, marginLeft: 2 },
});
