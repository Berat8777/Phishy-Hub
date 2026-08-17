import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Thin wrapper around expo-local-authentication for the "biometric unlock"
 * deep integration (task brief item 6). Deliberately does NOT itself touch
 * SecureStore/tokenManager — AuthContext decides what "unlocked" means
 * (i.e. restoring the already-persisted session into memory).
 */

export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return isEnrolled;
}

export async function promptBiometricUnlock(reason: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    // No device-passcode fallback in the RN prompt itself — a failed/cancelled
    // biometric attempt falls back to the normal password login screen
    // (AuthContext / app/unlock.tsx), not the OS passcode prompt.
    disableDeviceFallback: true,
    cancelLabel: 'Use password instead',
  });
  return result.success;
}
