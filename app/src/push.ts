// Registrering för pushnotiser (används i den riktiga appen, inte i webbprototypen).
// Token sparas i backend (Neon via API på Vercel) och används av tränarens "Skicka notis" via Expo Push API,
// som i sin tur levererar via Apple (APNs) och Google (FCM).
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'StarkMamma',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data; // ExponentPushToken[...] – skickas till backend och kopplas till deltagaren
}

/**
 * Anropas när deltagaren trycker på en notis. Notiser från backend skickas med
 * `data: { noticeId }`, och appen öppnar då notisens informationssida om den har en,
 * annars inkorgen. (I webbappen gör service workern samma sak via `data.url`.)
 */
export function onNotificationOpened(open: (noticeId: string | undefined) => void) {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { noticeId?: string } | undefined;
    open(data?.noticeId);
  });
  return () => sub.remove();
}
