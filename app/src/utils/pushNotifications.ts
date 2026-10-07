import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from '../api/client';

// Controls how notifications behave while the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Requests permission (if not already granted), gets the Expo push token,
// and sends it to the backend so it can be attached to the logged-in user.
// Safe to call every app open — it's a no-op if permission is already
// granted and the token hasn't changed.
export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    // Push tokens don't work on simulators/emulators.
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('No EAS projectId found — cannot generate push token.');
    return null;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenResponse.data;

      await api.post('/auth/me/push-token', { push_token: token });
      console.log('push token saved for current user');

      return token;
    } catch (err) {
      if (attempt === 2) {
        console.warn('Push token unavailable:', err);
        return null;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return null;
}