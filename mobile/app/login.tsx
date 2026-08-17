import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../src/auth/AuthContext';
import { isApiError } from '../src/api/errors';
import { colors, fontFamily, fontSize, radii, spacing } from '../src/theme/theme';

export default function LoginScreen() {
  const { login, biometricAvailable, enableBiometricUnlock } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (biometricAvailable) {
        Alert.alert(
          'Enable biometric unlock?',
          'Use Face ID / fingerprint to sign back in instantly next time, instead of typing your password.',
          [
            { text: 'Not now', style: 'cancel', onPress: () => router.replace('/channels') },
            {
              text: 'Enable',
              onPress: async () => {
                await enableBiometricUnlock();
                router.replace('/channels');
              },
            },
          ],
        );
      } else {
        router.replace('/channels');
      }
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(isApiError(err) ? err.message : 'Could not sign in. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.brand}>Phishy Hub</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@phishyhub.local"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textSubtle}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.button, (submitting || pressed) && styles.buttonPressed]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>{submitting ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgCanvas },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  brand: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['3xl'],
    color: colors.accent,
    marginBottom: spacing[1],
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginBottom: spacing[6],
  },
  field: { marginBottom: spacing[4] },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing[1],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    color: colors.textDefault,
    backgroundColor: colors.surfaceRaised,
  },
  error: {
    color: colors.danger,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    marginBottom: spacing[3],
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  buttonPressed: { backgroundColor: colors.accentHover },
  buttonText: {
    color: colors.textOnAccent,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
  },
});
