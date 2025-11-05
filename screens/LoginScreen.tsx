import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import supabase from '../lib/supabase';

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<'user' | 'doctor' | 'nurse'>('user');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    
    try {
      const success = await login(username, password, userType);
      
      if (!success) {
        // Check if it's an unverified email issue
        if (userType === 'user') {
          const { data } = await supabase.rpc('login_user', {
            p_identifier: username,
            p_password: password,
          });
          
          if (data?.error?.includes('verify your email') && data?.user_id) {
            Alert.alert(
              'Email Not Verified',
              'Please verify your email before logging in. Would you like to resend the verification code?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Resend OTP',
                  onPress: async () => {
                    try {
                      const { data: resendData } = await supabase.rpc('resend_otp', {
                        p_user_id: data.user_id,
                      });
                      
                      if (resendData?.success) {
                        // Send OTP email via backend API
                        try {
                          const otpCode = resendData.otp_code;
                          
                          // Get user email (we need to extract it from the error or store it)
                          // For now, we'll need the email from somewhere
                          await fetch('https://palliative-care.vercel.app/api/auth/send-otp', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              email: username, // Assuming username is email
                              otp_code: otpCode,
                              user_type: 'user'
                            })
                          });
                          
                          console.log('[Resend OTP] Email sent from login screen');
                        } catch (emailError) {
                          console.error('[Resend OTP] Failed to send email:', emailError);
                        }
                        
                        Alert.alert('OTP Sent', 'A new verification code has been sent to your email.');
                      } else {
                        Alert.alert('Error', resendData?.error || 'Failed to resend OTP');
                      }
                    } catch (error: any) {
                      Alert.alert('Error', error.message);
                    }
                  },
                },
              ]
            );
            setLoading(false);
            return;
          }
        }
        
        Alert.alert('Login Failed', 'Invalid username or password');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Palliative Care</Text>
          <Text style={styles.subtitle}>Healthcare Management System</Text>

          <View style={styles.card}>
            <Text style={styles.loginTitle}>Sign In</Text>

            {/* User Type Selection */}
            <View style={styles.userTypeContainer}>
              <TouchableOpacity
                style={[styles.userTypeButton, userType === 'user' && styles.userTypeButtonActive]}
                onPress={() => setUserType('user')}
              >
                <Text style={[styles.userTypeText, userType === 'user' && styles.userTypeTextActive]}>
                  Patient
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.userTypeButton, userType === 'doctor' && styles.userTypeButtonActive]}
                onPress={() => setUserType('doctor')}
              >
                <Text style={[styles.userTypeText, userType === 'doctor' && styles.userTypeTextActive]}>
                  Doctor
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.userTypeButton, userType === 'nurse' && styles.userTypeButtonActive]}
                onPress={() => setUserType('nurse')}
              >
                <Text style={[styles.userTypeText, userType === 'nurse' && styles.userTypeTextActive]}>
                  Nurse
                </Text>
              </TouchableOpacity>
            </View>

            {/* Username Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>

            {/* Sign Up Link */}
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.linkText}>
                Don't have an account? <Text style={styles.linkTextBold}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 40,
    opacity: 0.9,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  userTypeContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  userTypeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  userTypeButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  userTypeText: {
    textAlign: 'center',
    color: '#666',
    fontWeight: '600',
    fontSize: 12,
  },
  userTypeTextActive: {
    color: '#fff',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#667eea',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  linkTextBold: {
    color: '#667eea',
    fontWeight: 'bold',
  },
});
