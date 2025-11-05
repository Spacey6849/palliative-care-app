import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import NotificationService from './services/NotificationService';

// Screens
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import MedicationsScreen from './screens/MedicationsScreen';
import MapsScreen from './screens/MapsScreen';
import ChatScreen from './screens/ChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import NotificationHistoryScreen from './screens/NotificationHistoryScreen';
import NotificationTestScreen from './screens/NotificationTestScreen';

import { RootStackParamList, MainTabParamList } from './types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Medications') {
            iconName = focused ? 'medical' : 'medical-outline';
          } else if (route.name === 'Maps') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Chat') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Medications" component={MedicationsScreen} />
      <Tab.Screen name="Maps" component={MapsScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function PlaceholderScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Ionicons name="construct" size={64} color="#ccc" />
      <Ionicons name="hammer" size={32} color="#ccc" style={{ marginTop: 16 }} />
      <Ionicons name="information-circle" size={24} color="#667eea" style={{ marginTop: 16 }} />
    </View>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="NotificationHistory" component={NotificationHistoryScreen} />
          <Stack.Screen 
            name="NotificationTest" 
            component={NotificationTestScreen}
            options={{ headerShown: true, title: 'Test Notifications' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    // Set up notification listeners
    NotificationService.setupNotificationListeners(
      undefined,
      (response) => {
        // Handle notification tap
        const data = response.notification.request.content.data;
        
        if (navigationRef.current && data.type) {
          setTimeout(() => {
            switch (data.type) {
              case 'chat':
                navigationRef.current.navigate('MainTabs', {
                  screen: 'Chat',
                });
                break;
              case 'appointment':
                navigationRef.current.navigate('MainTabs', {
                  screen: 'Home',
                });
                break;
              case 'medication':
                navigationRef.current.navigate('MainTabs', {
                  screen: 'Medications',
                });
                break;
              case 'emergency':
                navigationRef.current.navigate('MainTabs', {
                  screen: 'Maps',
                });
                break;
            }
          }, 100);
        }
      }
    );

    return () => {
      NotificationService.removeNotificationListeners();
    };
  }, []);

  return (
    <AuthProvider>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="light" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
