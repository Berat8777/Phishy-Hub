import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import * as channelsApi from '../../src/api/endpoints/channels';
import { ChannelListItem } from '../../src/components/ChannelListItem';
import { colors, fontFamily, fontSize, spacing } from '../../src/theme/theme';
import type { ChannelListItemDTO } from '../../src/api/types';

export default function ChannelListScreen() {
  const { status, user, logout } = useAuth();
  const router = useRouter();

  const [channels, setChannels] = useState<ChannelListItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { items } = await channelsApi.listChannels();
      setChannels(items);
    } catch {
      setError('Could not load channels. Pull to retry.');
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [status, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (status !== 'authenticated') return <Redirect href="/" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Channels</Text>
          {user ? (
            <Text style={styles.subtitle}>
              {user.firstName} {user.lastName}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={() => void logout()} hitSlop={12}>
          <Text style={styles.logout}>Sign out</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={channels}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChannelListItem channel={item} onPress={() => router.push(`/channels/${item.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={channels.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No channels yet</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgCanvas },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surfaceRaised,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.textDefault },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.textMuted },
  logout: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: colors.danger },
  error: {
    color: colors.danger,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    padding: spacing[3],
    textAlign: 'center',
  },
  separator: { height: 1, backgroundColor: colors.borderSubtle, marginLeft: spacing[4] + 44 + spacing[3] },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing[8] },
  emptyText: { fontFamily: fontFamily.regular, color: colors.textMuted, fontSize: fontSize.md },
});
