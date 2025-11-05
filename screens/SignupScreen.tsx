import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../lib/supabase';
import NotificationService from '../services/NotificationService';

type SignupScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Signup'>;
};

export default function SignupScreen({ navigation }: SignupScreenProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !username || !fullName || !password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('register_user', {
        p_email: email,
        p_username: username,
        p_full_name: fullName,
        p_phone: phone || null,
        p_location: address || null,
        p_password: password,
      });

      if (error || data?.error) {
        Alert.alert('Signup Failed', error?.message || data?.error || 'An error occurred');
      } else if (data?.success && data?.user_id) {
        setUserId(data.user_id);
        
        // Send OTP email via backend API
        try {
          const otpCode = data.otp_code; // Get OTP from response (for development)
          
          console.log('[Signup] Sending OTP email to:', email);
          
          // Call backend API to send OTP email
          const emailResponse = await fetch('https://palliative-care.vercel.app/api/auth/send-otp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: email,
              otp_code: otpCode,
              user_type: 'user'
            })
          });
          
          const emailResult = await emailResponse.json();
          
          if (!emailResponse.ok) {
            console.error('[Signup] Email API error:', emailResult);
            throw new Error(emailResult.error || 'Failed to send OTP email');
          }
          
          console.log('[Signup] ✅ OTP email sent successfully:', emailResult);
          
          setShowOtpScreen(true);
          Alert.alert(
            'OTP Sent',
            `A 6-digit verification code has been sent to ${email}. Please check your inbox (and spam folder).`,
            [{ text: 'OK' }]
          );
        } catch (emailError: any) {
          console.error('[Signup] Failed to send OTP email:', emailError);
          
          // Show error but allow user to continue
          Alert.alert(
            'Email Send Failed',
            `Could not send OTP to ${email}. Error: ${emailError.message}. Your OTP code is: ${data.otp_code}`,
            [
              { 
                text: 'Retry', 
                onPress: async () => {
                  try {
                    await fetch('https://palliative-care.vercel.app/api/auth/send-otp', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        email: email,
                        otp_code: data.otp_code,
                        user_type: 'user'
                      })
                    });
                    Alert.alert('Success', 'OTP email sent!');
                  } catch (e) {
                    console.error('Retry failed:', e);
                  }
                }
              },
              { 
                text: 'Continue', 
                onPress: () => setShowOtpScreen(true)
              }
            ]
          );
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit OTP code');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('verify_otp', {
        p_user_id: userId,
        p_otp: otp,
      });

      if (error || data?.error) {
        Alert.alert('Verification Failed', error?.message || data?.error || 'Invalid OTP code');
      } else if (data?.success) {
        // Register push notification token
        try {
          console.log('[Signup] Registering for push notifications...');
          const pushToken = await NotificationService.registerForPushNotifications();
          
          if (pushToken && pushToken !== 'local-only' && data?.session_token) {
            console.log('[Signup] Registering push token with backend...');
            await NotificationService.registerPushTokenWithBackend(userId!, data.session_token);
          } else if (pushToken === 'local-only') {
            console.log('[Signup] ⚠️ Push notifications configured for local-only mode (Firebase not set up)');
          }
        } catch (notifError: any) {
          console.log('[Signup] Push notification registration failed (non-critical):', notifError.message);
          // Don't block signup if notifications fail
        }

        Alert.alert('Success', 'Your account has been verified successfully!', [
          { text: 'OK', onPress: () => navigation.navigate('Login') },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!userId) return;

    setResendLoading(true);

    try {
      const { data, error } = await supabase.rpc('resend_otp', {
        p_user_id: userId,
      });

      if (error || data?.error) {
        Alert.alert('Error', error?.message || data?.error || 'Failed to resend OTP');
      } else if (data?.success) {
        // Send OTP email via backend API
        try {
          const otpCode = data.otp_code; // Get OTP from response (for development)
          
          console.log('[Resend OTP] Sending email to:', email);
          
          const emailResponse = await fetch('https://palliative-care.vercel.app/api/auth/send-otp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: email,
              otp_code: otpCode,
              user_type: 'user'
            })
          });
          
          const emailResult = await emailResponse.json();
          
          if (!emailResponse.ok) {
            console.error('[Resend OTP] Email API error:', emailResult);
            throw new Error(emailResult.error || 'Failed to send email');
          }
          
          console.log('[Resend OTP] ✅ Email sent successfully:', emailResult);
          
          Alert.alert('Success', `A new OTP code has been sent to ${email}. Check your inbox (and spam folder).`);
        } catch (emailError: any) {
          console.error('[Resend OTP] Failed to send email:', emailError);
          Alert.alert(
            'Email Send Failed', 
            `Could not send OTP. Error: ${emailError.message}. Your OTP code is: ${data.otp_code}`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!showOtpScreen ? (
          <>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Palliative Care Platform</Text>

            <View style={styles.card}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Username *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Choose a username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., +91-9876543210"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Address</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter your address"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Password *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter password (min 6 characters)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm Password *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <Text style={styles.requiredText}>* Required fields</Text>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSignup}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Sign Up</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.linkText}>
                  Already have an account? <Text style={styles.linkTextBold}>Login</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowOtpScreen(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <View style={styles.otpContainer}>
              <Ionicons name="mail-outline" size={80} color="#fff" />
              <Text style={styles.title}>Verify Email</Text>
              <Text style={styles.subtitle}>
                We've sent a 6-digit code to{'\n'}
                <Text style={styles.emailText}>{email}</Text>
              </Text>

              <View style={styles.card}>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Enter OTP Code</Text>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="000000"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Verify & Continue</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.resendContainer}>
                  <Text style={styles.resendText}>Didn't receive the code?</Text>
                  <TouchableOpacity
                    onPress={handleResendOtp}
                    disabled={resendLoading}
                  >
                    <Text style={[styles.linkTextBold, resendLoading && styles.textDisabled]}>
                      {resendLoading ? 'Sending...' : 'Resend OTP'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
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
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  requiredText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
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
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  otpContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emailText: {
    fontWeight: 'bold',
    color: '#fff',
  },
  otpInput: {
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: 'bold',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  resendText: {
    color: '#666',
    fontSize: 14,
  },
  textDisabled: {
    opacity: 0.5,
  },
});
