import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NotificationService from '../services/NotificationService';
import * as Notifications from 'expo-notifications';

export default function NotificationTestScreen() {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState('Test notification message');
  const [testTitle, setTestTitle] = useState('Test Notification');
  const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);

  useEffect(() => {
    loadPushToken();
    loadScheduledNotifications();
  }, []);

  const loadPushToken = async () => {
    const token = await NotificationService.registerForPushNotifications();
    setPushToken(token);
  };

  const loadScheduledNotifications = async () => {
    const notifications = await NotificationService.getScheduledNotifications();
    setScheduledNotifications(notifications);
  };

  const sendImmediateNotification = async () => {
    try {
      const notificationId = await NotificationService.scheduleNotification({
        type: 'chat',
        title: testTitle,
        body: testMessage,
        data: { test: true },
      });
      
      Alert.alert('Success', `Notification sent! ID: ${notificationId}`);
      loadScheduledNotifications();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const sendScheduledNotification = async () => {
    try {
      // Schedule notification for 10 seconds from now
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: testTitle + ' (Scheduled)',
          body: testMessage,
          data: { test: true, scheduled: true },
          sound: 'default',
        },
        trigger: {
          seconds: 10,
        } as any,
      });
      
      Alert.alert('Success', `Notification scheduled for 10 seconds from now! ID: ${notificationId}`);
      loadScheduledNotifications();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const sendChatNotification = async () => {
    const notificationId = await NotificationService.sendChatNotification(
      'Dr. Smith',
      'Your test results are ready. Please check your messages.',
      'test-conversation-123'
    );
    Alert.alert('Success', `Chat notification sent! ID: ${notificationId}`);
  };

  const sendMedicationNotification = async () => {
    // Schedule for 15 seconds from now
    const time = new Date(Date.now() + 15000);
    const notificationId = await NotificationService.sendMedicationNotification(
      'Aspirin',
      '100mg',
      time
    );
    Alert.alert('Success', `Medication reminder scheduled for 15 seconds from now! ID: ${notificationId}`);
    loadScheduledNotifications();
  };

  const sendEmergencyNotification = async () => {
    const notificationId = await NotificationService.sendEmergencyNotification(
      'John Doe',
      'Critical heart rate detected'
    );
    Alert.alert('Success', `Emergency alert sent! ID: ${notificationId}`);
  };

  const clearAllNotifications = async () => {
    await NotificationService.cancelAllNotifications();
    Alert.alert('Success', 'All scheduled notifications cleared!');
    loadScheduledNotifications();
  };

  const checkPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    Alert.alert('Permission Status', `Current permission: ${status}`);
  };

  const requestPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    Alert.alert('Permission Status', `Permission ${status === 'granted' ? 'granted' : 'denied'}`);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="notifications" size={48} color="#667eea" />
        <Text style={styles.title}>Push Notification Test</Text>
      </View>

      {/* Push Token Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📱 Push Token</Text>
        {pushToken ? (
          <View style={styles.tokenContainer}>
            <Text style={styles.tokenLabel}>Your Expo Push Token:</Text>
            <Text style={styles.tokenText} selectable>
              {pushToken}
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.buttonSmall]}
              onPress={() => {
                if (Platform.OS === 'android') {
                  Alert.alert('Token Copied', pushToken);
                }
              }}
            >
              <Text style={styles.buttonText}>Copy Token</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.button} onPress={loadPushToken}>
            <Ionicons name="key" size={20} color="#fff" />
            <Text style={styles.buttonText}>Get Push Token</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Custom Test Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>✏️ Custom Test</Text>
        <TextInput
          style={styles.input}
          placeholder="Notification Title"
          value={testTitle}
          onChangeText={setTestTitle}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Notification Message"
          value={testMessage}
          onChangeText={setTestMessage}
          multiline
          numberOfLines={3}
        />
        <TouchableOpacity style={styles.button} onPress={sendImmediateNotification}>
          <Ionicons name="send" size={20} color="#fff" />
          <Text style={styles.buttonText}>Send Now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={sendScheduledNotification}
        >
          <Ionicons name="time" size={20} color="#667eea" />
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
            Schedule (10s)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Preset Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 Preset Tests</Text>
        
        <TouchableOpacity
          style={[styles.button, styles.chatButton]}
          onPress={sendChatNotification}
        >
          <Ionicons name="chatbubbles" size={20} color="#fff" />
          <Text style={styles.buttonText}>Chat Message</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.medicationButton]}
          onPress={sendMedicationNotification}
        >
          <Ionicons name="medical" size={20} color="#fff" />
          <Text style={styles.buttonText}>Medication (15s)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.emergencyButton]}
          onPress={sendEmergencyNotification}
        >
          <Ionicons name="alert" size={20} color="#fff" />
          <Text style={styles.buttonText}>Emergency Alert</Text>
        </TouchableOpacity>
      </View>

      {/* Permissions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔐 Permissions</Text>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={checkPermissions}
        >
          <Ionicons name="information-circle" size={20} color="#667eea" />
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
            Check Permissions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={requestPermissions}
        >
          <Ionicons name="lock-open" size={20} color="#667eea" />
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
            Request Permissions
          </Text>
        </TouchableOpacity>
      </View>

      {/* Scheduled Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📅 Scheduled Notifications ({scheduledNotifications.length})</Text>
        {scheduledNotifications.length > 0 ? (
          scheduledNotifications.map((notif, index) => (
            <View key={index} style={styles.scheduledItem}>
              <Text style={styles.scheduledTitle}>{notif.content.title}</Text>
              <Text style={styles.scheduledBody}>{notif.content.body}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No scheduled notifications</Text>
        )}
        <TouchableOpacity
          style={[styles.button, styles.buttonDanger]}
          onPress={clearAllNotifications}
        >
          <Ionicons name="trash" size={20} color="#fff" />
          <Text style={styles.buttonText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ℹ️ Instructions</Text>
        <Text style={styles.instruction}>
          1. Copy your push token above{'\n'}
          2. Go to https://expo.dev/notifications{'\n'}
          3. Paste your token and send a test notification{'\n'}
          4. Or use the buttons above to test local notifications{'\n'}
          5. Make sure notifications are enabled in device settings
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  tokenContainer: {
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tokenLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  tokenText: {
    fontSize: 11,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonSmall: {
    padding: 10,
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  buttonDanger: {
    backgroundColor: '#e74c3c',
  },
  chatButton: {
    backgroundColor: '#3498db',
  },
  medicationButton: {
    backgroundColor: '#2ecc71',
  },
  emergencyButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonTextSecondary: {
    color: '#667eea',
  },
  scheduledItem: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  scheduledTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  scheduledBody: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
  instruction: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
});
