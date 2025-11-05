import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useAuth } from '../context/AuthContext';
import supabase from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import NotificationService from '../services/NotificationService';

WebBrowser.maybeCompleteAuthSession();

type Medication = {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  start_date: string;
  end_date?: string;
  prescribing_doctor: string;
  instructions?: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  created_at: string;
};

export default function MedicationsScreen() {
  const { user, role, sessionToken } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null);

  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://palliative-care.vercel.app';

  useEffect(() => {
    if (user) {
      fetchMedications();
      checkCalendarConnection();
      setupNotifications();
    }
  }, [user]);

  const setupNotifications = async () => {
    const token = await NotificationService.registerForPushNotifications();
    if (token && user && sessionToken) {
      await NotificationService.registerPushTokenWithBackend(user.id, sessionToken);
    }
  };

  const checkCalendarConnection = async () => {
    try {
      const response = await fetch(`${API_URL}/api/calendar/status`, {
        headers: {
          'Cookie': `bl_session=${sessionToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setCalendarConnected(data.connected || false);
        setCalendarEmail(data.email || null);
      }
    } catch (error) {
      console.error('Error checking calendar status:', error);
    }
  };

  const fetchMedications = async () => {
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMedications(data || []);
    } catch (error) {
      console.error('Error fetching medications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAccept = async (medicationId: string) => {
    try {
      const { data, error } = await supabase.rpc('accept_prescription', {
        p_medication_id: medicationId,
        p_user_id: user?.id,
      });

      if (error || data?.error) {
        Alert.alert('Error', data?.error || error.message);
      } else {
        Alert.alert('Success', 'Prescription accepted!');
        
        // Schedule notification reminder
        const medication = medications.find(m => m.id === medicationId);
        if (medication) {
          await scheduleMedicationReminder(medication);
        }
        
        fetchMedications();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const scheduleMedicationReminder = async (medication: Medication) => {
    try {
      // Parse frequency to determine reminder time
      // Example: "Once daily" -> schedule at 9 AM
      // "Twice daily" -> schedule at 9 AM and 9 PM
      // "Three times daily" -> 8 AM, 2 PM, 8 PM
      
      const frequency = medication.frequency.toLowerCase();
      
      if (frequency.includes('once')) {
        await NotificationService.scheduleDailyMedication(
          medication.medication_name,
          medication.dosage,
          9, // 9 AM
          0
        );
      } else if (frequency.includes('twice')) {
        await NotificationService.scheduleDailyMedication(
          medication.medication_name,
          medication.dosage,
          9, // 9 AM
          0
        );
        await NotificationService.scheduleDailyMedication(
          medication.medication_name,
          medication.dosage,
          21, // 9 PM
          0
        );
      } else if (frequency.includes('three')) {
        await NotificationService.scheduleDailyMedication(
          medication.medication_name,
          medication.dosage,
          8, // 8 AM
          0
        );
        await NotificationService.scheduleDailyMedication(
          medication.medication_name,
          medication.dosage,
          14, // 2 PM
          0
        );
        await NotificationService.scheduleDailyMedication(
          medication.medication_name,
          medication.dosage,
          20, // 8 PM
          0
        );
      }
      
      Alert.alert('Reminder Set', 'You will receive notifications for this medication');
    } catch (error) {
      console.error('Error scheduling reminder:', error);
    }
  };

  const connectGoogleCalendar = async () => {
    try {
      // Open the backend OAuth URL in browser
      const url = `${API_URL}/api/calendar/auth`;
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
        
        // Poll for connection status
        setTimeout(async () => {
          await checkCalendarConnection();
        }, 5000);
      } else {
        Alert.alert('Error', 'Cannot open calendar connection');
      }
    } catch (error) {
      console.error('Error connecting calendar:', error);
      Alert.alert('Error', 'Failed to connect Google Calendar');
    }
  };

  const addToGoogleCalendar = async (medication: Medication) => {
    try {
      const response = await fetch(`${API_URL}/api/calendar/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `bl_session=${sessionToken}`,
        },
        body: JSON.stringify({
          medication_id: medication.id,
          medication_name: medication.medication_name,
          dosage: medication.dosage,
          frequency: medication.frequency,
          reminder_time: '09:00',
          days_of_week: [0, 1, 2, 3, 4, 5, 6], // Every day
        }),
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Added to Google Calendar!');
      } else {
        Alert.alert('Error', data.error || 'Failed to add to calendar');
      }
    } catch (error) {
      console.error('Error adding to calendar:', error);
      Alert.alert('Error', 'Failed to add to Google Calendar');
    }
  };

  const handleReject = async (medicationId: string) => {
    Alert.alert(
      'Reject Prescription',
      'Are you sure you want to reject this prescription?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data, error } = await supabase.rpc('reject_prescription', {
                p_medication_id: medicationId,
                p_user_id: user?.id,
                p_reason: 'Rejected by patient',
              });

              if (error || data?.error) {
                Alert.alert('Error', data?.error || error?.message || 'Failed to reject prescription');
              } else {
                Alert.alert('Success', 'Prescription rejected');
                fetchMedications();
              }
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMedications();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="medical" size={28} color="#667eea" />
          <Text style={styles.headerTitle}>My Medications</Text>
        </View>
        {!calendarConnected ? (
          <TouchableOpacity style={styles.calendarButton} onPress={connectGoogleCalendar}>
            <Ionicons name="calendar" size={18} color="#667eea" />
            <Text style={styles.calendarButtonText}>Connect Calendar</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.calendarConnected}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.calendarConnectedText}>
              {calendarEmail ? calendarEmail.split('@')[0] : 'Connected'}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {medications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="medical-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No prescriptions yet</Text>
            <Text style={styles.emptySubtext}>Your doctor will send prescriptions here</Text>
          </View>
        ) : (
          medications.map((med) => (
            <View key={med.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.titleRow}>
                  <Ionicons name="medical" size={20} color="#667eea" />
                  <Text style={styles.medicationName}>{med.medication_name}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(med.status) }]}>
                  <Text style={styles.statusText}>{med.status}</Text>
                </View>
              </View>

              <Text style={styles.doctor}>Prescribed by {med.prescribing_doctor}</Text>

              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Dosage:</Text>
                  <Text style={styles.detailValue}>{med.dosage}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Frequency:</Text>
                  <Text style={styles.detailValue}>{med.frequency}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Start Date:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(med.start_date).toLocaleDateString()}
                  </Text>
                </View>
                {med.end_date && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>End Date:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(med.end_date).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>

              {med.instructions && (
                <View style={styles.instructionsBox}>
                  <Text style={styles.instructionsLabel}>Instructions:</Text>
                  <Text style={styles.instructionsText}>{med.instructions}</Text>
                </View>
              )}

              {med.status === 'pending' && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleAccept(med.id)}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleReject(med.id)}
                  >
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}

              {med.status === 'active' && calendarConnected && (
                <TouchableOpacity
                  style={styles.addToCalendarButton}
                  onPress={() => addToGoogleCalendar(med)}
                >
                  <Ionicons name="calendar-outline" size={18} color="#667eea" />
                  <Text style={styles.addToCalendarText}>Add to Google Calendar</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.receivedDate}>
                Received {new Date(med.created_at).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#667eea',
    backgroundColor: '#fff',
  },
  calendarButtonText: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '600',
  },
  calendarConnected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  calendarConnectedText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  doctor: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  detailItem: {
    width: '48%',
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  instructionsBox: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  instructionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  addToCalendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#667eea',
    backgroundColor: '#f0f4ff',
  },
  addToCalendarText: {
    color: '#667eea',
    fontWeight: '600',
    fontSize: 13,
  },
  receivedDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 12,
  },
});
