import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Enable web browser to handle OAuth redirects
WebBrowser.maybeCompleteAuthSession();

export default function ProfileScreen() {
  const { user, role, logout } = useAuth();
  const navigation = useNavigation();
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Google OAuth Configuration
  const GOOGLE_CLIENT_ID = '747458881949-v4qiuq6fq7qa3rpuoqk3ofjf0hcde6mv.apps.googleusercontent.com';
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'palliativecare',
    path: 'calendar/callback'
  });

  // Check calendar connection status on load
  useEffect(() => {
    checkCalendarStatus();
  }, []);

  const checkCalendarStatus = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (!sessionToken) return;

      const response = await fetch('https://palliative-care.vercel.app/api/calendar/status', {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCalendarConnected(!!data.connected);
        setCalendarEmail(data.email || null);
      }
    } catch (error) {
      console.error('Error checking calendar status:', error);
    }
  };

  const connectGoogleCalendar = async () => {
    try {
      setIsConnecting(true);

      // Create OAuth request
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid email profile https://www.googleapis.com/auth/calendar');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      // Open browser for OAuth
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl.toString(),
        redirectUri
      );

      if (result.type === 'success' && result.url) {
        // Extract authorization code from callback URL
        const params = new URL(result.url).searchParams;
        const code = params.get('code');

        if (code) {
          // Exchange code for tokens (you'll need a backend endpoint for this)
          await exchangeCodeForTokens(code);
        } else {
          Alert.alert('Error', 'Failed to get authorization code');
        }
      } else {
        Alert.alert('Cancelled', 'Calendar connection was cancelled');
      }
    } catch (error: any) {
      console.error('Error connecting calendar:', error);
      Alert.alert('Error', error.message || 'Failed to connect Google Calendar');
    } finally {
      setIsConnecting(false);
    }
  };

  const exchangeCodeForTokens = async (code: string) => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (!sessionToken) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      // Exchange code for tokens via backend
      const response = await fetch('https://palliative-care.vercel.app/api/calendar/exchange-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          code,
          redirect_uri: redirectUri
        })
      });

      const data = await response.json();

      if (data.success) {
        setCalendarConnected(true);
        setCalendarEmail(data.email);
        Alert.alert('Success', 'Google Calendar connected successfully!');
      } else {
        Alert.alert('Error', data.error || 'Failed to connect calendar');
      }
    } catch (error: any) {
      console.error('Error exchanging code:', error);
      Alert.alert('Error', 'Failed to complete calendar connection');
    }
  };

  const disconnectCalendar = async () => {
    Alert.alert(
      'Disconnect Calendar',
      'Are you sure you want to disconnect Google Calendar?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              const sessionToken = await AsyncStorage.getItem('session_token');
              if (!sessionToken) return;

              const response = await fetch('https://palliative-care.vercel.app/api/calendar/disconnect', {
                method: 'POST',
                headers: { Authorization: `Bearer ${sessionToken}` }
              });

              if (response.ok) {
                setCalendarConnected(false);
                setCalendarEmail(null);
                Alert.alert('Success', 'Calendar disconnected');
              }
            } catch (error) {
              console.error('Error disconnecting calendar:', error);
              Alert.alert('Error', 'Failed to disconnect calendar');
            }
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={80} color="#667eea" />
        </View>
        <Text style={styles.userName}>{user?.full_name}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{role}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>Username</Text>
              <Text style={styles.infoValue}>{user?.username}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>Role</Text>
              <Text style={styles.infoValue}>{role}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Integrations</Text>
          <View style={styles.infoCard}>
            <View style={styles.calendarSection}>
              <View style={styles.calendarHeader}>
                <Ionicons name="calendar-outline" size={24} color="#667eea" />
                <View style={styles.calendarInfo}>
                  <Text style={styles.calendarTitle}>Google Calendar</Text>
                  {calendarConnected && calendarEmail && (
                    <Text style={styles.calendarEmail}>{calendarEmail}</Text>
                  )}
                </View>
              </View>
              
              {isConnecting ? (
                <ActivityIndicator color="#667eea" />
              ) : calendarConnected ? (
                <TouchableOpacity
                  style={styles.disconnectButton}
                  onPress={disconnectCalendar}
                >
                  <Text style={styles.disconnectButtonText}>Disconnect</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.connectButton}
                  onPress={connectGoogleCalendar}
                >
                  <Text style={styles.connectButtonText}>Connect</Text>
                </TouchableOpacity>
              )}
            </View>
            {calendarConnected && (
              <View style={styles.calendarNote}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={styles.calendarNoteText}>
                  Medication reminders will sync to your Google Calendar
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => navigation.navigate('NotificationHistory' as never)}
          >
            <Ionicons name="notifications-outline" size={24} color="#667eea" />
            <Text style={styles.settingText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => navigation.navigate('NotificationTest' as never)}
          >
            <Ionicons name="flask-outline" size={24} color="#f59e0b" />
            <Text style={styles.settingText}>Test Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Ionicons name="lock-closed-outline" size={24} color="#667eea" />
            <Text style={styles.settingText}>Privacy</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Ionicons name="help-circle-outline" size={24} color="#667eea" />
            <Text style={styles.settingText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    color: '#fff',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 12,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  version: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 24,
  },
  calendarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  calendarInfo: {
    flex: 1,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  calendarEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  connectButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  disconnectButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  disconnectButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  calendarNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  calendarNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
  },
});
