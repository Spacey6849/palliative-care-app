import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type NotificationRecord = {
  id: string;
  title: string;
  body: string;
  data: any;
  timestamp: number;
  read: boolean;
  type: 'chat' | 'appointment' | 'medication' | 'emergency' | 'prescription' | 'other';
};

export default function NotificationHistoryScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNotificationHistory();
    
    // Listen for new notifications
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      addNotificationToHistory(notification);
    });

    return () => subscription.remove();
  }, []);

  const loadNotificationHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(`notifications_${user?.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setNotifications(parsed.sort((a: NotificationRecord, b: NotificationRecord) => b.timestamp - a.timestamp));
      }
    } catch (error) {
      console.error('Error loading notification history:', error);
    }
  };

  const addNotificationToHistory = async (notification: Notifications.Notification) => {
    try {
      const newNotif: NotificationRecord = {
        id: notification.request.identifier,
        title: notification.request.content.title || 'Notification',
        body: notification.request.content.body || '',
        data: notification.request.content.data,
        timestamp: Date.now(),
        read: false,
        type: (notification.request.content.data?.type as any) || 'other',
      };

      const stored = await AsyncStorage.getItem(`notifications_${user?.id}`);
      const existing = stored ? JSON.parse(stored) : [];
      
      // Don't add duplicate chat notifications from same conversation
      if (newNotif.type === 'chat') {
        const conversationId = newNotif.data?.conversationId;
        const recentChat = existing.find((n: NotificationRecord) => 
          n.type === 'chat' && 
          n.data?.conversationId === conversationId &&
          Date.now() - n.timestamp < 60000 // Within last minute
        );
        if (recentChat) {
          // Update existing instead of adding new
          const updated = existing.map((n: NotificationRecord) => 
            n.id === recentChat.id ? { ...n, body: newNotif.body, timestamp: newNotif.timestamp } : n
          );
          await AsyncStorage.setItem(`notifications_${user?.id}`, JSON.stringify(updated));
          setNotifications(updated.sort((a: NotificationRecord, b: NotificationRecord) => b.timestamp - a.timestamp));
          return;
        }
      }

      const updated = [newNotif, ...existing].slice(0, 100); // Keep last 100
      await AsyncStorage.setItem(`notifications_${user?.id}`, JSON.stringify(updated));
      setNotifications(updated);
    } catch (error) {
      console.error('Error adding notification to history:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const updated = notifications.map(n => 
        n.id === id ? { ...n, read: true } : n
      );
      setNotifications(updated);
      await AsyncStorage.setItem(`notifications_${user?.id}`, JSON.stringify(updated));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const clearAll = async () => {
    try {
      await AsyncStorage.removeItem(`notifications_${user?.id}`);
      setNotifications([]);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const handleNotificationPress = (notif: NotificationRecord) => {
    markAsRead(notif.id);
    
    // Navigate based on notification type
    const nav = navigation as any;
    switch (notif.type) {
      case 'chat':
        nav.navigate('MainTabs', { screen: 'Chat' });
        break;
      case 'medication':
      case 'prescription':
        nav.navigate('MainTabs', { screen: 'Medications' });
        break;
      case 'appointment':
        nav.navigate('MainTabs', { screen: 'Home' });
        break;
      case 'emergency':
        nav.navigate('MainTabs', { screen: 'Maps' });
        break;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotificationHistory();
    setRefreshing(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'chat':
        return 'chatbubbles';
      case 'medication':
      case 'prescription':
        return 'medical';
      case 'appointment':
        return 'calendar';
      case 'emergency':
        return 'alert-circle';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'chat':
        return '#3498db';
      case 'medication':
      case 'prescription':
        return '#2ecc71';
      case 'appointment':
        return '#667eea';
      case 'emergency':
        return '#e74c3c';
      default:
        return '#95a5a6';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderNotification = ({ item }: { item: NotificationRecord }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.unreadCard]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(item.type) }]}>
        <Ionicons name={getNotificationIcon(item.type) as any} size={24} color="#fff" />
      </View>
      
      <View style={styles.contentContainer}>
        <Text style={[styles.title, !item.read && styles.unreadText]}>
          {item.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.timestamp}>
          {formatTimestamp(item.timestamp)}
        </Text>
      </View>

      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadBannerText}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>
            You'll see your notifications here
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '600',
  },
  unreadBanner: {
    backgroundColor: '#667eea',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  unreadBannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadCard: {
    backgroundColor: '#f0f4ff',
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: 'bold',
  },
  body: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#667eea',
    marginLeft: 8,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
    textAlign: 'center',
  },
});
