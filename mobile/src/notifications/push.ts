import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Client-side push notification plumbing (task brief item 7).
 *
 * IMPORTANT scope note: `api/CONTRACT.md` has no device-token registration
 * endpoint (grep confirms no "/users/:id/push-token" or similar route
 * exists) — actually DELIVERING a push notification requires a backend that
 * stores per-user Expo push tokens and calls Expo's push API, which is out
 * of scope for this pass / a backend follow-up. What IS wired up and
 * testable without that backend:
 *  - requesting notification permission
 *  - obtaining an Expo push token (logged, not sent anywhere yet — see
 *    `registerForPushNotificationsAsync`'s doc comment)
 *  - the foreground notification handler (so a socket-driven local
 *    notification can be shown while the app is open — see
 *    `notifyNewMessage` below, wired from the chat screen's socket
 *    listener for messages that arrive while the user isn't looking at
 *    that channel)
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let cachedPushToken: string | null = null;

/**
 * Requests permission and fetches an Expo push token. Returns `null` on
 * simulators/emulators (no push capability) or if permission is denied.
 *
 * There is nowhere to SEND this token yet (see module doc comment) — this
 * function's return value is currently only used for a one-time debug log
 * from AuthContext after login. Follow-up: once `api/` grows a device-token
 * endpoint (e.g. `POST /users/me/push-tokens`), call it here.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (cachedPushToken) return cachedPushToken;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    cachedPushToken = tokenResponse.data;
    return cachedPushToken;
  } catch {
    // Expected on plain Expo Go / simulators without full push capability —
    // not fatal to the rest of the app.
    return null;
  }
}

/**
 * Fires a local notification for a socket-delivered `message:new` that
 * arrives while the app is foregrounded but the user isn't looking at that
 * channel (chat screen decides when to call this). This is the
 * "local-notification-on-foreground-message" path called out in the task
 * brief as what's testable without a real push backend.
 */
export async function notifyNewMessage(input: { channelName: string; senderName: string; body: string }): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: input.channelName,
      body: `${input.senderName}: ${input.body}`,
    },
    trigger: null, // fire immediately
  });
}
