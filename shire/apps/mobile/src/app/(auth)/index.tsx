import React, { useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useAuth } from '@/features/auth';
import { useIsWorkdayActive } from '@/features/workday';

const DARK_MODE_BG = '#121214';

export default function LoginScreen() {
  const router = useRouter();
  const { isAuthenticated, currentLocation, signIn } = useAuth();
  const isWorkdayActive = useIsWorkdayActive(currentLocation?.id ?? null);
  const nextAuthenticatedHref = (isWorkdayActive ? '/(host)' : '/workday') as Href;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (isAuthenticated && currentLocation) {
    return <Redirect href={nextAuthenticatedHref} />;
  }

  if (isAuthenticated && !currentLocation) {
    return <Redirect href="/(auth)/location" />;
  }

  const handleLogin = async () => {
    if (!email.trim() || !password.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    const { error } = await signIn(email.trim(), password);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.replace('/(auth)/location');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View
        style={[styles.cinematicBackground, { backgroundColor: DARK_MODE_BG }]}
        entering={FadeIn.duration(1000)}
      >
        <ImageBackground
          source={require('../../../assets/images/abstract_cinematic_bg.png')}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      </Animated.View>

      <View style={styles.contentOverlay}>
        <Animated.View
          style={styles.logoContainer}
          entering={FadeInDown.duration(800).delay(300).springify()}
        >
          <Text style={styles.logoText}>SHIRE</Text>
          <Text style={styles.logoSubText}>HOST TERMINAL</Text>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.duration(600).delay(700).springify()}
          style={[styles.glassPanel, { backgroundColor: 'rgba(25, 25, 30, 0.88)' }]}
        >
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="name@restaurant.com"
                  placeholderTextColor="#666"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#888"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

            <TouchableOpacity
              style={[styles.loginButton, isSubmitting && styles.loginButtonDisabled]}
              activeOpacity={0.8}
              onPress={() => void handleLogin()}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={18} color="#000" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cinematicBackground: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  contentOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  glassPanel: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 32,
    padding: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoText: {
    fontSize: 56,
    fontWeight: '300',
    letterSpacing: 4,
    color: '#FFF',
  },
  logoSubText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 4,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
  },
  formContainer: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    lineHeight: 18,
  },
  loginButton: {
    marginTop: 8,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F8D66D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
});
