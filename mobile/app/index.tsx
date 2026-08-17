import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { colors } from '../src/theme/theme';

/**
 * Pure router — decides where to send the user based on AuthContext's
 * status. Never rendered as actual UI beyond a brief loading spinner while
 * `bootstrap()` reads SecureStore.
 */
export default function Index() {
  const { status } = useAuth();

  if (status === 'booting') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (status === 'locked') return <Redirect href="/unlock" />;
  if (status === 'unauthenticated') return <Redirect href="/login" />;
  return <Redirect href="/channels" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCanvas,
  },
});
