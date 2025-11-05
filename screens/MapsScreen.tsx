import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, Circle, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import supabase from '../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = 360;

// Helper function to adjust color brightness
const adjustColorBrightness = (color: string, amount: number): string => {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

type PatientStatus = 'normal' | 'warning' | 'critical' | 'emergency';

interface PatientData {
  id: string;
  full_name: string;
  lat: number;
  lng: number;
  emergency: boolean;
  last_updated: string;
  heart_rate?: number;
  spo2?: number;
  body_temp?: number;
  room_temp?: number;
  room_humidity?: number;
  fall_detected: boolean;
  status: PatientStatus;
}

interface VitalTrend {
  time: string;
  value: number;
}

export default function MapsScreen() {
  const { user, sessionToken } = useAuth();
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics'>('dashboard');
  const [activeChart, setActiveChart] = useState<'heart_rate' | 'spo2' | 'body_temp'>('heart_rate');
  const [trendData, setTrendData] = useState<VitalTrend[]>([]);
  
  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const mapRef = useRef<MapView>(null);
  
  // Pulse animation for markers
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Heartbeat animation for status indicator
  const heartbeatAnim = useRef(new Animated.Value(1)).current;
  
  // Floating animation for info card
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('[Maps] Component mounted, fetching patients...');
    fetchPatients();
    const interval = setInterval(fetchPatients, 5000);
    
    // Start continuous pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Start heartbeat animation (faster pulse)
    Animated.loop(
      Animated.sequence([
        Animated.timing(heartbeatAnim, {
          toValue: 1.2,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(heartbeatAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(heartbeatAnim, {
          toValue: 1.2,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(heartbeatAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Start floating animation for info card
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -5,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    return () => {
      console.log('[Maps] Component unmounting, clearing interval');
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      fetchTrendData(selectedPatient.id);
    }
  }, [selectedPatient, activeChart]);

  const fetchPatients = async () => {
    try {
      console.log('[Maps] Fetching patients from patient_status table...');
      
      // Fetch real patient data from backend API
      const { data, error } = await supabase
        .from('patient_status')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('[Maps] Error fetching patients:', error);
        throw error;
      }

      console.log('[Maps] Fetched patients:', data?.length || 0);

      const fetchedPatients: PatientData[] = (data || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        lat: p.lat,
        lng: p.lng,
        emergency: !!p.emergency,
        last_updated: p.last_updated,
        heart_rate: p.heart_rate,
        spo2: p.spo2,
        body_temp: p.body_temp,
        room_temp: p.room_temp,
        room_humidity: p.room_humidity,
        fall_detected: !!p.fall_detected,
        status: p.status || 'normal',
      }));

      console.log('[Maps] Processed patients:', fetchedPatients.map(p => ({ name: p.full_name, lat: p.lat, lng: p.lng })));

      setPatients(fetchedPatients);
      
      // Don't auto-select - only show card when marker is clicked
      // if (!selectedPatient && fetchedPatients.length > 0) {
      //   setSelectedPatient(fetchedPatients[0]);
      //   console.log('[Maps] Auto-selected patient:', fetchedPatients[0].full_name);
      // }
    } catch (error) {
      console.error('[Maps] Error fetching patients:', error);
    }
  };

  const fetchTrendData = async (patientId: string) => {
    // Mock trend data
    const mockTrends: VitalTrend[] = [
      { time: '08:00', value: 70 },
      { time: '10:00', value: 72 },
      { time: '12:00', value: 75 },
      { time: '14:00', value: 73 },
      { time: '16:00', value: 72 },
    ];
    setTrendData(mockTrends);
  };

  const toggleSidebar = () => {
    const toValue = isSidebarOpen ? -SIDEBAR_WIDTH : 0;
    Animated.spring(sidebarAnim, {
      toValue,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    setIsSidebarOpen(!isSidebarOpen);
  };

  const selectPatient = (patient: PatientData) => {
    try {
      setSelectedPatient(patient);
      setSearchQuery(patient.full_name);
      
      // Animate to patient location on map
      if (mapRef.current && patient?.lat && patient?.lng) {
        mapRef.current.animateToRegion({
          latitude: patient.lat,
          longitude: patient.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }, 1000);
      }
      
      // Open sidebar to show patient details
      if (!isSidebarOpen) {
        toggleSidebar();
      }
    } catch (error) {
      console.error('Error selecting patient:', error);
    }
  };

  const filteredPatients = patients.filter(p =>
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getMarkerColor = (status: PatientStatus, emergency: boolean) => {
    if (emergency) return '#dc2626';
    switch (status) {
      case 'emergency': return '#dc2626';
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#22c55e';
    }
  };

  const getStatusColor = (status: PatientStatus, emergency: boolean) => {
    if (emergency) return '#dc2626';
    switch (status) {
      case 'emergency': return '#dc2626';
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#22c55e';
    }
  };

  const getMetricStatus = (value: number, type: 'heart_rate' | 'spo2' | 'body_temp') => {
    switch (type) {
      case 'heart_rate':
        if (value >= 60 && value <= 100) return 'good';
        if (value >= 50 && value <= 120) return 'warning';
        return 'critical';
      case 'spo2':
        if (value >= 95) return 'good';
        if (value >= 90) return 'warning';
        return 'critical';
      case 'body_temp':
        if (value >= 36.1 && value <= 37.2) return 'good';
        if (value >= 35.5 && value <= 38.0) return 'warning';
        return 'critical';
      default:
        return 'good';
    }
  };

  const MetricCard = ({ label, value, unit, icon, status }: {
    label: string;
    value: string;
    unit: string;
    icon: string;
    status: 'good' | 'warning' | 'critical';
  }) => (
    <View style={[styles.metricCard, status === 'critical' && styles.metricCritical, status === 'warning' && styles.metricWarning]}>
      <View style={styles.metricHeader}>
        <Ionicons name={icon as any} size={16} color={status === 'critical' ? '#dc2626' : status === 'warning' ? '#f59e0b' : '#22c55e'} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>
        {value} <Text style={styles.metricUnit}>{unit}</Text>
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        showsMyLocationButton={true}
        initialRegion={{
          latitude: 15.488527,
          longitude: 73.852363,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Interactive circle overlays for each patient */}
        {patients.map((patient) => {
          const markerColor = getMarkerColor(patient.status, patient.emergency);
          const isSelected = selectedPatient?.id === patient.id;
          return (
            <Circle
              key={`circle-${patient.id}`}
              center={{
                latitude: patient.lat || 0,
                longitude: patient.lng || 0,
              }}
              radius={isSelected ? 200 : 150}
              strokeWidth={isSelected ? 4 : 3}
              strokeColor={markerColor}
              fillColor={isSelected ? `${markerColor}30` : `${markerColor}15`}
            />
          );
        })}

        {/* Patient markers - Premium 3D Interactive Design */}
        {patients.map((patient) => {
          const markerColor = getMarkerColor(patient.status, patient.emergency);
          const isEmergency = patient.emergency || patient.status === 'emergency';
          const isSelected = selectedPatient?.id === patient.id;
          
          return (
            <Marker
              key={patient.id}
              coordinate={{
                latitude: patient.lat || 0,
                longitude: patient.lng || 0,
              }}
              tracksViewChanges={false}
              onPress={() => setSelectedPatient(patient)}
            >
              {/* 3D Layered Marker Design */}
              <View style={styles.markerContainer}>
                {/* Animated pulse rings for all patients */}
                <Animated.View 
                  style={[
                    styles.markerPulseRing1, 
                    { 
                      borderColor: markerColor,
                      transform: [{ scale: pulseAnim }],
                      opacity: pulseAnim.interpolate({
                        inputRange: [1, 1.3],
                        outputRange: [0.3, 0]
                      })
                    }
                  ]} 
                />
                <Animated.View 
                  style={[
                    styles.markerPulseRing2, 
                    { 
                      borderColor: markerColor,
                      transform: [{ scale: pulseAnim }],
                      opacity: pulseAnim.interpolate({
                        inputRange: [1, 1.3],
                        outputRange: [0.5, 0.1]
                      })
                    }
                  ]} 
                />
                {isEmergency && (
                  <Animated.View 
                    style={[
                      styles.markerPulseRing3, 
                      { 
                        borderColor: '#dc2626',
                        transform: [{ scale: pulseAnim }],
                        opacity: pulseAnim.interpolate({
                          inputRange: [1, 1.3],
                          outputRange: [0.2, 0]
                        })
                      }
                    ]} 
                  />
                )}
                
                {/* Outer glow shadow */}
                <View 
                  style={[
                    styles.markerGlowShadow, 
                    { 
                      backgroundColor: markerColor,
                      opacity: isSelected ? 0.4 : 0.25,
                    }
                  ]} 
                />
                
                {/* 3D Ring Border */}
                <View style={[styles.marker3DRing, { borderColor: markerColor }]}>
                  {/* Inner white ring for depth */}
                  <View style={styles.markerWhiteRing}>
                    {/* Main gradient circle */}
                    <LinearGradient
                      colors={[
                        adjustColorBrightness(markerColor, 20),
                        markerColor,
                        adjustColorBrightness(markerColor, -20)
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        styles.markerGradientCircle,
                        isSelected && styles.markerSelected
                      ]}
                    >
                      {/* Icon container with subtle shadow */}
                      <View style={styles.markerIconContainer}>
                        <Ionicons 
                          name={isEmergency ? "alert" : "person"} 
                          size={isSelected ? 28 : 24} 
                          color="#fff"
                          style={styles.markerIcon}
                        />
                        
                        {/* Status indicator dot with heartbeat */}
                        <Animated.View style={[
                          styles.markerStatusIndicator,
                          { 
                            backgroundColor: '#fff',
                            transform: [{ scale: heartbeatAnim }]
                          }
                        ]}>
                          <View style={[
                            styles.markerStatusDotInner,
                            { backgroundColor: markerColor }
                          ]} />
                        </Animated.View>
                      </View>
                      
                      {/* Shimmer effect overlay - animated */}
                      <Animated.View 
                        style={[
                          styles.markerShimmer,
                          {
                            opacity: pulseAnim.interpolate({
                              inputRange: [1, 1.3],
                              outputRange: [0.3, 0.6]
                            })
                          }
                        ]} 
                      />
                    </LinearGradient>
                  </View>
                </View>
                
                {/* Name label below marker */}
                <View style={[styles.markerNameTag, { backgroundColor: markerColor }]}>
                  <Text style={styles.markerNameText} numberOfLines={1}>
                    {patient.full_name.split(' ')[0]}
                  </Text>
                </View>
              </View>
              
              {/* Glass-morphism Callout */}
              <Callout
                tooltip
                onPress={() => {
                  try {
                    selectPatient(patient);
                  } catch (error) {
                    console.error('Callout press error:', error);
                  }
                }}
              >
                <View style={styles.glassCallout}>
                  {/* Glass overlay effect */}
                  <View style={styles.glassOverlay} />
                  
                  {/* Header */}
                  <View style={[styles.glassHeader, { borderBottomColor: markerColor }]}>
                    <View style={styles.glassHeaderLeft}>
                      <Ionicons name="person-circle" size={24} color={markerColor} />
                      <Text style={styles.glassTitle}>{patient.full_name}</Text>
                    </View>
                    <View style={[styles.glassStatusBadge, { backgroundColor: markerColor }]}>
                      <Text style={styles.glassStatusText}>
                        {isEmergency ? 'EMERGENCY' : patient.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Vitals Grid */}
                  <View style={styles.glassBody}>
                    <View style={styles.glassVitalsGrid}>
                      {/* Heart Rate */}
                      <View style={styles.glassVitalCard}>
                        <View style={[styles.glassIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                          <Ionicons name="heart" size={18} color="#ef4444" />
                        </View>
                        <Text style={styles.glassVitalLabel}>Heart Rate</Text>
                        <Text style={styles.glassVitalValue}>{patient.heart_rate || '--'}</Text>
                        <Text style={styles.glassVitalUnit}>bpm</Text>
                      </View>
                      
                      {/* SpO2 */}
                      <View style={styles.glassVitalCard}>
                        <View style={[styles.glassIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                          <Ionicons name="water" size={18} color="#3b82f6" />
                        </View>
                        <Text style={styles.glassVitalLabel}>SpO₂</Text>
                        <Text style={styles.glassVitalValue}>{patient.spo2 || '--'}</Text>
                        <Text style={styles.glassVitalUnit}>%</Text>
                      </View>
                      
                      {/* Body Temp */}
                      <View style={styles.glassVitalCard}>
                        <View style={[styles.glassIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                          <Ionicons name="thermometer" size={18} color="#f59e0b" />
                        </View>
                        <Text style={styles.glassVitalLabel}>Body Temp</Text>
                        <Text style={styles.glassVitalValue}>
                          {patient.body_temp ? patient.body_temp.toFixed(1) : '--'}
                        </Text>
                        <Text style={styles.glassVitalUnit}>°C</Text>
                      </View>
                    </View>
                    
                    {/* Alert if fall detected */}
                    {patient.fall_detected && (
                      <View style={styles.glassAlert}>
                        <Ionicons name="alert-circle" size={16} color="#dc2626" />
                        <Text style={styles.glassAlertText}>Fall Detected!</Text>
                      </View>
                    )}
                    
                    {/* Footer */}
                    <View style={styles.glassFooter}>
                      <Ionicons name="time-outline" size={12} color="#9ca3af" />
                      <Text style={styles.glassFooterText}>
                        Updated {new Date(patient.last_updated).toLocaleTimeString()}
                      </Text>
                    </View>
                    
                    <Text style={styles.glassTapHint}>Tap for more details</Text>
                  </View>
                  
                  {/* Arrow pointer */}
                  <View style={styles.glassArrow}>
                    <View style={styles.glassArrowInner} />
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Selected Patient Info Card - Premium Glass Morphism Design */}
      {selectedPatient && !isSidebarOpen && (
        <Animated.View 
          style={[
            styles.premiumInfoCard,
            {
              transform: [{ translateY: floatAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.98)', 'rgba(255, 255, 255, 0.92)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumCardGradient}
          >
            {/* Close Button */}
            <TouchableOpacity 
              style={styles.premiumCloseButton}
              onPress={() => setSelectedPatient(null)}
              activeOpacity={0.6}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 1)', 'rgba(249, 250, 251, 1)']}
                style={styles.premiumCloseButtonInner}
              >
                <Ionicons name="close-circle" size={26} color="#6b7280" />
              </LinearGradient>
            </TouchableOpacity>

            {/* Decorative gradient line at top */}
            <LinearGradient
              colors={[
                getStatusColor(selectedPatient.status, selectedPatient.emergency),
                adjustColorBrightness(getStatusColor(selectedPatient.status, selectedPatient.emergency), -30)
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.premiumTopLine}
            />

            {/* Header Section */}
            <View style={styles.premiumHeader}>
              {/* Status Badge with pulse */}
              <Animated.View style={[
                styles.premiumStatusBadge, 
                { 
                  backgroundColor: `${getStatusColor(selectedPatient.status, selectedPatient.emergency)}20`,
                  transform: [{ scale: heartbeatAnim }]
                }
              ]}>
                <Animated.View style={[
                  styles.premiumStatusDot, 
                  { 
                    backgroundColor: getStatusColor(selectedPatient.status, selectedPatient.emergency),
                    transform: [{ scale: heartbeatAnim }]
                  }
                ]} />
                <Text style={[
                  styles.premiumStatusText, 
                  { color: getStatusColor(selectedPatient.status, selectedPatient.emergency) }
                ]}>
                  {selectedPatient.emergency ? 'EMERGENCY' : selectedPatient.status.toUpperCase()}
                </Text>
              </Animated.View>
            </View>

            {/* Patient Info */}
            <View style={styles.premiumPatientSection}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.premiumAvatar}
              >
                <Ionicons name="person" size={24} color="#fff" />
              </LinearGradient>
              <View style={styles.premiumPatientInfo}>
                <Text style={styles.premiumPatientName}>{selectedPatient.full_name}</Text>
                <Text style={styles.premiumPatientId}>ID: {selectedPatient.id.substring(0, 8)}</Text>
              </View>
            </View>

            {/* Vitals Grid - Premium Cards */}
            <View style={styles.premiumVitalsGrid}>
              {/* Heart Rate */}
              <View style={styles.premiumVitalCard}>
                <View style={[styles.premiumVitalIconBox, { backgroundColor: '#fee2e2' }]}>
                  <Ionicons name="heart" size={20} color="#dc2626" />
                </View>
                <View style={styles.premiumVitalContent}>
                  <Text style={styles.premiumVitalLabel}>Heart Rate</Text>
                  <View style={styles.premiumVitalValueRow}>
                    <Text style={[styles.premiumVitalValue, { color: '#dc2626' }]}>
                      {selectedPatient.heart_rate || '--'}
                    </Text>
                    <Text style={styles.premiumVitalUnit}>bpm</Text>
                  </View>
                </View>
              </View>

              {/* SpO2 */}
              <View style={styles.premiumVitalCard}>
                <View style={[styles.premiumVitalIconBox, { backgroundColor: '#dbeafe' }]}>
                  <Ionicons name="water" size={20} color="#2563eb" />
                </View>
                <View style={styles.premiumVitalContent}>
                  <Text style={styles.premiumVitalLabel}>SpO₂</Text>
                  <View style={styles.premiumVitalValueRow}>
                    <Text style={[styles.premiumVitalValue, { color: '#2563eb' }]}>
                      {selectedPatient.spo2 || '--'}
                    </Text>
                    <Text style={styles.premiumVitalUnit}>%</Text>
                  </View>
                </View>
              </View>

              {/* Body Temp */}
              <View style={styles.premiumVitalCard}>
                <View style={[styles.premiumVitalIconBox, { backgroundColor: '#fef3c7' }]}>
                  <Ionicons name="thermometer" size={20} color="#d97706" />
                </View>
                <View style={styles.premiumVitalContent}>
                  <Text style={styles.premiumVitalLabel}>Body Temp</Text>
                  <View style={styles.premiumVitalValueRow}>
                    <Text style={[styles.premiumVitalValue, { color: '#d97706' }]}>
                      {selectedPatient.body_temp ? selectedPatient.body_temp.toFixed(1) : '--'}
                    </Text>
                    <Text style={styles.premiumVitalUnit}>°C</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Footer with tap hint */}
            <View style={styles.premiumFooter}>
              <Ionicons name="hand-left" size={12} color="#9ca3af" />
              <Text style={styles.premiumTapHint}>Tap marker for full details</Text>
            </View>
          </LinearGradient>
        </Animated.View>
      )}

      {/* Toggle Button */}
      <TouchableOpacity
        style={[styles.toggleButton, isSidebarOpen && styles.toggleButtonOpen]}
        onPress={toggleSidebar}
      >
        <Ionicons name={isSidebarOpen ? 'chevron-back' : 'chevron-forward'} size={24} color="#fff" />
      </TouchableOpacity>

      {/* Sidebar */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{ translateX: sidebarAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sidebarGradient}
        >
          <View style={styles.sidebarContent}>
            {/* Header */}
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Dashboard</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'dashboard' && styles.tabActive]}
                onPress={() => setActiveTab('dashboard')}
              >
                <Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>
                  Dashboard
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'analytics' && styles.tabActive]}
                onPress={() => setActiveTab('analytics')}
              >
                <Text style={[styles.tabText, activeTab === 'analytics' && styles.tabTextActive]}>
                  Analytics
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#9ca3af" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search patients..."
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Content */}
            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {activeTab === 'dashboard' ? (
                <>
                  {/* Selected Patient Details */}
                  {selectedPatient && (
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Ionicons name="heart" size={18} color="#ef4444" />
                        <Text style={styles.cardTitle}>{selectedPatient.full_name}</Text>
                      </View>
                      <Text style={styles.cardSubtitle}>
                        Last updated: {new Date(selectedPatient.last_updated).toLocaleTimeString()}
                      </Text>

                      {/* Metrics Grid */}
                      <View style={styles.metricsGrid}>
                        {selectedPatient.heart_rate && (
                          <MetricCard
                            label="Heart Rate"
                            value={String(selectedPatient.heart_rate)}
                            unit="bpm"
                            icon="pulse"
                            status={getMetricStatus(selectedPatient.heart_rate, 'heart_rate')}
                          />
                        )}
                        {selectedPatient.spo2 && (
                          <MetricCard
                            label="SpO₂"
                            value={String(selectedPatient.spo2)}
                            unit="%"
                            icon="water"
                            status={getMetricStatus(selectedPatient.spo2, 'spo2')}
                          />
                        )}
                        {selectedPatient.body_temp && (
                          <MetricCard
                            label="Body Temp"
                            value={selectedPatient.body_temp.toFixed(1)}
                            unit="°C"
                            icon="thermometer"
                            status={getMetricStatus(selectedPatient.body_temp, 'body_temp')}
                          />
                        )}
                        {selectedPatient.room_temp && (
                          <MetricCard
                            label="Room Temp"
                            value={selectedPatient.room_temp.toFixed(1)}
                            unit="°C"
                            icon="thermometer-outline"
                            status="good"
                          />
                        )}
                      </View>

                      {selectedPatient.fall_detected && (
                        <View style={styles.alertCard}>
                          <Ionicons name="warning" size={16} color="#dc2626" />
                          <Text style={styles.alertText}>Fall Detected!</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Patients List */}
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Patients Overview</Text>
                    <View style={styles.patientsList}>
                      {filteredPatients.map((patient) => (
                        <TouchableOpacity
                          key={patient.id}
                          style={[
                            styles.patientItem,
                            selectedPatient?.id === patient.id && styles.patientItemSelected,
                          ]}
                          onPress={() => selectPatient(patient)}
                        >
                          <View style={styles.patientInfo}>
                            <Text style={[styles.patientName, selectedPatient?.id === patient.id && styles.patientNameSelected]}>
                              {patient.full_name}
                            </Text>
                            <Text style={[styles.patientVitals, selectedPatient?.id === patient.id && styles.patientVitalsSelected]}>
                              HR: {patient.heart_rate} • SpO₂: {patient.spo2}% • {patient.body_temp}°C
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.patientStatusDot,
                              { backgroundColor: getStatusColor(patient.status, patient.emergency) },
                              patient.emergency && styles.pulsingDot,
                            ]}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              ) : (
                /* Analytics Tab */
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Patient Analytics</Text>
                  <View style={styles.analyticsGrid}>
                    <View style={styles.analyticCard}>
                      <Text style={styles.analyticValue}>{patients.length}</Text>
                      <Text style={styles.analyticLabel}>Total Patients</Text>
                    </View>
                    <View style={[styles.analyticCard, styles.analyticCardGreen]}>
                      <Text style={[styles.analyticValue, styles.analyticValueGreen]}>
                        {patients.filter(p => p.status === 'normal').length}
                      </Text>
                      <Text style={styles.analyticLabel}>Stable</Text>
                    </View>
                    <View style={[styles.analyticCard, styles.analyticCardYellow]}>
                      <Text style={[styles.analyticValue, styles.analyticValueYellow]}>
                        {patients.filter(p => p.status === 'warning' || p.status === 'critical').length}
                      </Text>
                      <Text style={styles.analyticLabel}>Needs Attention</Text>
                    </View>
                    <View style={[styles.analyticCard, styles.analyticCardRed]}>
                      <Text style={[styles.analyticValue, styles.analyticValueRed]}>
                        {patients.filter(p => p.emergency || p.status === 'emergency').length}
                      </Text>
                      <Text style={styles.analyticLabel}>Emergency</Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  toggleButton: {
    position: 'absolute',
    left: 0,
    top: '50%',
    width: 40,
    height: 60,
    backgroundColor: '#667eea',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1000,
  },
  toggleButtonOpen: {
    left: SIDEBAR_WIDTH,
  },
  infoCard: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    maxWidth: 280,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  infoCardStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  infoCardStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Modern Info Card Styles
  modernInfoCard: {
    position: 'absolute',
    top: 60,
    right: 16,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    maxWidth: 320,
  },
  infoCardGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  modernStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  modernStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  modernStatusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modernCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modernAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(102, 126, 234, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modernCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  modernQuickVitals: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(102, 126, 234, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  modernVitalItem: {
    alignItems: 'center',
    gap: 4,
  },
  modernVitalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modernVitalLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
  },
  modernVitalDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
  },
  modernTapHint: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Premium Info Card Styles
  premiumInfoCard: {
    position: 'absolute',
    top: 60,
    right: 16,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    maxWidth: 340,
  },
  premiumCardGradient: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  premiumCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  premiumCloseButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  premiumTopLine: {
    height: 4,
    width: '100%',
  },
  premiumHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  premiumStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  premiumStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  premiumStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  premiumPatientSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    backgroundColor: 'rgba(102, 126, 234, 0.03)',
  },
  premiumAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    elevation: 4,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  premiumPatientInfo: {
    flex: 1,
  },
  premiumPatientName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  premiumPatientId: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  premiumVitalsGrid: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  premiumVitalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  premiumVitalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  premiumVitalContent: {
    flex: 1,
  },
  premiumVitalLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  premiumVitalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  premiumVitalValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  premiumVitalUnit: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '600',
  },
  premiumFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 6,
    borderTopWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
  },
  premiumTapHint: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 999,
  },
  sidebarGradient: {
    flex: 1,
  },
  sidebarContent: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
  },
  sidebarHeader: {
    marginBottom: 16,
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  tabTextActive: {
    color: '#667eea',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  scrollContent: {
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  metricWarning: {
    backgroundColor: '#fef3c7',
    borderColor: '#fbbf24',
  },
  metricCritical: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  metricUnit: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6b7280',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  alertText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  patientsList: {
    gap: 8,
    marginTop: 12,
  },
  patientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  patientItemSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  patientNameSelected: {
    color: '#fff',
  },
  patientVitals: {
    fontSize: 11,
    color: '#6b7280',
  },
  patientVitalsSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  patientStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pulsingDot: {
    // Animation would need to be added separately
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  analyticCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  analyticCardGreen: {
    backgroundColor: '#d1fae5',
  },
  analyticCardYellow: {
    backgroundColor: '#fef3c7',
  },
  analyticCardRed: {
    backgroundColor: '#fee2e2',
  },
  analyticValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: 4,
  },
  analyticValueGreen: {
    color: '#059669',
  },
  analyticValueYellow: {
    color: '#d97706',
  },
  analyticValueRed: {
    color: '#dc2626',
  },
  analyticLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  callout: {
    padding: 12,
    minWidth: 180,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  calloutText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  calloutStatus: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  // Premium 3D Interactive Marker Styles
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 100,
  },
  // Animated pulse rings
  markerPulseRing1: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    opacity: 0.3,
  },
  markerPulseRing2: {
    position: 'absolute',
    width: 75,
    height: 75,
    borderRadius: 37.5,
    borderWidth: 2,
    opacity: 0.5,
  },
  markerPulseRing3: {
    position: 'absolute',
    width: 105,
    height: 105,
    borderRadius: 52.5,
    borderWidth: 3,
    opacity: 0.2,
  },
  markerGlowShadow: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    opacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 15,
    elevation: 8,
  },
  marker3DRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  markerWhiteRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerGradientCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  markerSelected: {
    transform: [{ scale: 1.15 }],
    elevation: 10,
  },
  markerIconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  markerIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  markerStatusIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  markerStatusDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  markerShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    opacity: 0.5,
  },
  markerNameTag: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  markerNameText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  // Legacy marker styles (keep for compatibility)
  markerPin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  markerPinEmergency: {
    borderWidth: 4,
    transform: [{ scale: 1.1 }],
  },
  markerShadow: {
    width: 20,
    height: 6,
    borderRadius: 10,
    opacity: 0.3,
    marginTop: 2,
  },
  markerPulseOuter: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: '#ef4444',
    opacity: 0.4,
  },
  markerPulseMiddle: {
    position: 'absolute',
    width: 55,
    height: 55,
    borderRadius: 27.5,
    borderWidth: 2,
    borderColor: '#ef4444',
    opacity: 0.6,
  },
  markerPinWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerStatusDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  // Modern Circle Marker Styles
  markerGlowRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    opacity: 0.3,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  markerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  markerInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerPulse: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    opacity: 0.4,
  },
  // Modern Callout Styles
  modernCallout: {
    width: 240,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  modernCalloutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  calloutBody: {
    padding: 12,
    gap: 8,
  },
  calloutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calloutLabel: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
  },
  calloutValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  calloutAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  calloutAlertText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  calloutFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
  },
  calloutStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  calloutStatusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  calloutArrow: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  
  // Glass-morphism Callout Styles
  glassCallout: {
    width: 280,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  glassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  glassHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  glassHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  glassTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  glassStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  glassStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  glassBody: {
    padding: 12,
  },
  glassVitalsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  glassVitalCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  glassIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  glassVitalLabel: {
    fontSize: 10,
    color: '#9ca3af',
    marginBottom: 2,
    textAlign: 'center',
  },
  glassVitalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  glassVitalUnit: {
    fontSize: 10,
    color: '#6b7280',
  },
  glassAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    marginBottom: 12,
  },
  glassAlertText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fca5a5',
  },
  glassFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  glassFooterText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  glassTapHint: {
    fontSize: 11,
    color: '#60a5fa',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  glassArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(17, 24, 39, 0.85)',
    alignSelf: 'center',
    marginTop: -1,
  },
  glassArrowInner: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    position: 'absolute',
    top: -14,
    left: -8,
  },
});
