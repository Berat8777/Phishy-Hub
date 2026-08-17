import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../src/auth/AuthContext';
import * as tokenManager from '../src/api/tokenManager';
import { colors, fontFamily, fontSize, radii, spacing } from '../src/theme/theme';

/**
 * Shown when a session is persisted in SecureStore AND biometric unlock is
 * enabled for it (AuthContext status === 'locked'). Successful biometric
 * auth restores the app WITHOUT re-typing the password (task brief item 6);
 * "Use password instead" drops back to a normal login, replacing whatever
 * session was locked (matches web/desktop's plain re-login semantics).
 */
export default function UnlockScreen() {
  const { unlock, user } = useAuth();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [prompting, setPrompting] = useState(false);

  const attemptUnlock = useCallback(async () => {
    setPrompting(true);
    setFailed(false);
    try {
      const ok = await unlock();
      if (ok) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/channels');
      } else {
        setFailed(true);
      }
    } finally {
      setPrompting(false);
    }
  }, [unlock, router]);

  useEffect(() => {
    void attemptUnlock();
    // Prompt automatically once on mount — the "Unlock" button below is for retrying.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function usePasswordInstead() {
    // Biometric was declined for this launch; clear the persisted session
    // so the login screen starts fresh rather than half-locked-out.
    await tokenManager.setBiometricEnabled(false);
    tokenManager.clearSession();
    router.replace('/login');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Welcome back{user ? `, ${user.firstName}` : ''}</Text>
      <Text style={styles.subtitle}>Unlock with Face ID / fingerprint to continue</Text>

      {failed ? <Text style={styles.error}>Biometric authentication didn't succeed.</Text> : null}

      <Pressable style={styles.button} onPress={attemptUnlock} disabled={prompting}>
        <Text style={styles.buttonText}>{prompting ? 'Verifying…' : 'Unlock'}</Text>
      </Pressable>

      <Pressable onPress={usePasswordInstead}>
        <Text style={styles.link}>Use password instead</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    backgroundColor: colors.bgCanvas,
  },
  icon: { fontSize: 48, marginBottom: spacing[4] },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.textDefault,
    marginBottom: spacing[1],
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing[6],
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    marginBottom: spacing[4],
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  buttonText: {
    color: colors.textOnAccent,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
  },
  link: {
    color: colors.accent,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
});
