import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configure notification handler - this ensures notifications work when app is in background/foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // These settings ensure notifications are shown in all states
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    // iOS specific
    shouldShowBanner: true,
    shouldShowList: true,
  } as any),
});

export interface NotificationData {
  type: 'chat' | 'appointment' | 'medication' | 'emergency';
  title: string;
  body: string;
  data?: any;
}

class NotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;

  /**
   * Request notification permissions and get Expo push token
   */
  async registerForPushNotifications(): Promise<string | null> {
    // Skip on simulators and Expo Go (native module not included there)
    // appOwnership === 'expo' indicates Expo Go environment
    const isExpoGo = (Constants as any)?.appOwnership === 'expo';
    if (!Device.isDevice || isExpoGo) {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }

      // Configure Android channels FIRST (before getting token)
      if (Platform.OS === 'android') {
        await this.createNotificationChannels();
      }

      // Try to get the Expo push token
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
          console.warn('⚠️ Project ID not found - push notifications will be local only');
          // Still allow local notifications
          this.expoPushToken = 'local-only';
          return 'local-only';
        }

        const token = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        this.expoPushToken = token.data;
        console.log('✅ Expo Push Token:', token.data);
        return token.data;
      } catch (tokenError: any) {
        // If Firebase/FCM error, allow local notifications to work
        if (tokenError.message?.includes('FirebaseApp') || 
            tokenError.message?.includes('FCM') ||
            tokenError.message?.includes('Firebase')) {
          console.warn('⚠️ Firebase not configured - using local notifications only');
          console.warn('   To enable push notifications, follow: https://docs.expo.dev/push-notifications/fcm-credentials/');
          
          // Set a dummy token to indicate local-only mode
          this.expoPushToken = 'local-only';
          return 'local-only';
        }
        
        // Re-throw other errors
        throw tokenError;
      }
    } catch (error) {
      console.error('❌ Error getting push token:', error);
      
      // Still allow local notifications
      this.expoPushToken = 'local-only';
      return 'local-only';
    }
  }

  /**
   * Create Android notification channels
   */
  private async createNotificationChannels() {
    await Notifications.setNotificationChannelAsync('chat', {
      name: 'Chat Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
    });

    await Notifications.setNotificationChannelAsync('appointment', {
      name: 'Appointments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
    });

    await Notifications.setNotificationChannelAsync('medication', {
      name: 'Medication Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
    });

    await Notifications.setNotificationChannelAsync('emergency', {
      name: 'Emergency Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 100, 100, 100, 100, 100],
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      lightColor: '#FF0000',
    });
  }

  /**
   * Set up notification listeners
   */
  setupNotificationListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void
  ) {
    // Listener for notifications received while app is in foreground
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
        onNotificationReceived?.(notification);
      }
    );

    // Listener for when user taps on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification tapped:', response);
        onNotificationResponse?.(response);
      }
    );
  }

  /**
   * Remove notification listeners
   */
  removeNotificationListeners() {
    if (this.notificationListener) {
      try { this.notificationListener.remove?.(); } catch {}
      // Fallback legacy API if available
      // @ts-ignore
      if (Notifications.removeNotificationSubscription) {
        // @ts-ignore
        Notifications.removeNotificationSubscription(this.notificationListener);
      }
    }
    if (this.responseListener) {
      try { this.responseListener.remove?.(); } catch {}
      // Fallback legacy API if available
      // @ts-ignore
      if (Notifications.removeNotificationSubscription) {
        // @ts-ignore
        Notifications.removeNotificationSubscription(this.responseListener);
      }
    }
  }

  /**
   * Schedule a local notification
   */
  async scheduleNotification(
    notificationData: NotificationData,
    trigger?: Notifications.NotificationTriggerInput
  ) {
    try {
      const channelId = notificationData.type;
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notificationData.title,
          body: notificationData.body,
          data: notificationData.data || {},
          sound: 'default',
          priority: notificationData.type === 'emergency' 
            ? Notifications.AndroidNotificationPriority.MAX 
            : Notifications.AndroidNotificationPriority.HIGH,
          ...(Platform.OS === 'android' && { channelId }),
        },
        trigger: trigger || null, // null means immediate
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  /**
   * Send chat notification
   */
  async sendChatNotification(senderName: string, message: string, conversationId: string) {
    return this.scheduleNotification({
      type: 'chat',
      title: senderName,
      body: message,
      data: {
        type: 'chat',
        conversationId,
      },
    });
  }

  /**
   * Send appointment reminder notification
   */
  async sendAppointmentNotification(
    appointmentTitle: string,
    appointmentTime: Date,
    minutesBefore: number = 15
  ) {
    const triggerDate = new Date(appointmentTime.getTime() - minutesBefore * 60 * 1000);
    const seconds = Math.max(1, Math.round((triggerDate.getTime() - Date.now()) / 1000));
    const trigger: Notifications.NotificationTriggerInput = {
      // Fire after N seconds
      // @ts-ignore - union accepts this shape at runtime
      type: 'timeInterval',
      seconds,
      repeats: false,
    } as any;
    return this.scheduleNotification(
      {
        type: 'appointment',
        title: 'Appointment Reminder',
        body: `Your appointment "${appointmentTitle}" is in ${minutesBefore} minutes`,
        data: {
          type: 'appointment',
          appointmentTime: appointmentTime.toISOString(),
        },
      },
      trigger
    );
  }

  /**
   * Send medication reminder notification
   */
  async sendMedicationNotification(
    medicationName: string,
    dosage: string,
    time: Date
  ) {
    // Schedule at absolute time using interval from now
    const seconds = Math.max(1, Math.round((time.getTime() - Date.now()) / 1000));
    const trigger: Notifications.NotificationTriggerInput = {
      // @ts-ignore
      type: 'timeInterval',
      seconds,
      repeats: false,
    } as any;
    return this.scheduleNotification(
      {
        type: 'medication',
        title: 'Medication Reminder',
        body: `Time to take ${medicationName} (${dosage})`,
        data: {
          type: 'medication',
          medicationName,
          dosage,
        },
      },
      trigger
    );
  }

  /**
   * Schedule daily medication reminder
   */
  async scheduleDailyMedication(
    medicationName: string,
    dosage: string,
    hour: number,
    minute: number
  ) {
      // Daily repeating schedule via calendar trigger
      const trigger: Notifications.NotificationTriggerInput = {
        // @ts-ignore
        type: 'calendar',
        hour,
        minute,
        repeats: true,
      } as any;
      return this.scheduleNotification(
      {
        type: 'medication',
        title: 'Medication Reminder',
        body: `Time to take ${medicationName} (${dosage})`,
        data: {
          type: 'medication',
          medicationName,
          dosage,
        },
      },
        trigger
    );
  }

  /**
   * Send emergency alert notification
   */
  async sendEmergencyNotification(patientName: string, alertType: string) {
    return this.scheduleNotification({
      type: 'emergency',
      title: '🚨 EMERGENCY ALERT',
      body: `${alertType} detected for ${patientName}`,
      data: {
        type: 'emergency',
        patientName,
        alertType,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get scheduled notifications
   */
  async getScheduledNotifications() {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  /**
   * Set badge count (iOS)
   */
  async setBadgeCount(count: number) {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Get badge count (iOS)
   */
  async getBadgeCount() {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Get Expo push token
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Send push token to backend
   */
  async registerPushTokenWithBackend(_userId: string, sessionToken: string) {
    const token = this.getPushToken();
    if (!token) {
      console.error('No push token available');
      return false;
    }

    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://palliative-care.vercel.app';
      const response = await fetch(`${API_URL}/api/notifications/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `bl_session=${sessionToken}`,
        },
        body: JSON.stringify({
          token: token,
          deviceType: Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web',
        }),
      });

      const data = await response.json();
  return data.success || false;
    } catch (error) {
      console.error('Error registering push token:', error);
      return false;
    }
  }
}

export default new NotificationService();
