import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../lib/supabase';
import NotificationService from '../services/NotificationService';

type UserRole = 'user' | 'doctor' | 'nurse' | 'admin' | null;

type User = {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
};

type AuthContextType = {
  user: User | null;
  role: UserRole;
  sessionToken: string | null;
  login: (username: string, password: string, userType: 'user' | 'doctor' | 'nurse') => Promise<boolean>;
  logout: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  sessionToken: null,
  login: async () => false,
  logout: async () => {},
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredSession();
  }, []);

  const loadStoredSession = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      const storedUser = await AsyncStorage.getItem('user');
      const storedRole = await AsyncStorage.getItem('user_role');

      if (token && storedUser) {
        setSessionToken(token);
        setUser(JSON.parse(storedUser));
        setRole(storedRole as UserRole);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string, userType: 'user' | 'doctor' | 'nurse'): Promise<boolean> => {
    try {
      let functionName = '';
      switch (userType) {
        case 'user':
          functionName = 'login_user';
          break;
        case 'doctor':
          functionName = 'login_doctor';
          break;
        case 'nurse':
          functionName = 'login_nurse';
          break;
      }

      // login_user expects p_identifier (email or username), others expect p_username
      const params = functionName === 'login_user' 
        ? { p_identifier: username, p_password: password }
        : { p_username: username, p_password: password };

      const { data, error } = await supabase.rpc(functionName, params);

      if (error || data?.error) {
        console.error('Login error:', error || data?.error);
        return false;
      }

      if (data?.success) {
        const userData: User = {
          id: data.user_id || data.doctor_id || data.nurse_id,
          username: data.username,
          full_name: data.full_name,
          email: data.email,
          role: data.user_type,
        };

        await AsyncStorage.setItem('session_token', data.session_token);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        await AsyncStorage.setItem('user_role', data.user_type);

        setSessionToken(data.session_token);
        setUser(userData);
        setRole(data.user_type);

        // Register for push notifications after successful login
        try {
          const pushToken = await NotificationService.registerForPushNotifications();
          if (pushToken) {
            await NotificationService.registerPushTokenWithBackend(userData.id, data.session_token);
            console.log('Push notifications registered successfully');
          }
        } catch (notifError) {
          console.error('Failed to register push notifications:', notifError);
          // Don't fail login if notification registration fails
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('session_token');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('user_role');
      setSessionToken(null);
      setUser(null);
      setRole(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, sessionToken, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
