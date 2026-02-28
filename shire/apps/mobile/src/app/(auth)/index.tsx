import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    useWindowDimensions,
    ImageBackground,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    SlideInDown,
    ZoomIn,
    withDelay,
    withSpring,
    withTiming,
    useSharedValue,
    useAnimatedStyle,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// We'll use this file to mock the cinematic backgrounds based on system theme later
// For now, using a solid, rich dark gradient placeholder
const DARK_MODE_BG = '#121214';

export default function LoginScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isIPad = width > 768;

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = () => {
        // Navigate to host dashboard
        router.replace('/(host)');
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Cinematic Background */}
            <Animated.View style={[styles.cinematicBackground, { backgroundColor: DARK_MODE_BG }]} entering={FadeIn.duration(1000)}>
                <ImageBackground
                    source={require('../../../assets/images/abstract_cinematic_bg.png')}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                />
            </Animated.View>

            <View style={styles.contentOverlay}>

                {/* Animated Logo - Appears First */}
                <Animated.View
                    style={[styles.logoContainer, { marginTop: isIPad ? -180 : -140 }]}
                    entering={FadeInDown.duration(800).delay(300).springify()}
                >
                    <Text style={styles.logoText}>SHIRE</Text>
                    <Text style={styles.logoSubText}>HOST TERMINAL</Text>
                </Animated.View>

                {/* The Glass Login Module (Fallback) */}
                <Animated.View
                    entering={FadeInUp.duration(600).delay(1200).springify()}
                    style={[
                        styles.glassPanel,
                        isIPad ? styles.glassPanelIPad : styles.glassPanelIPhone,
                        { backgroundColor: 'rgba(25, 25, 30, 0.85)' } // Fallback for when expo-blur native module isn't built
                    ]}
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
                                <Ionicons name="lock-closed-outline" size={20} color="#888" style={styles.inputIcon} />
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

                        <TouchableOpacity
                            style={styles.loginButton}
                            activeOpacity={0.8}
                            onPress={handleLogin}
                        >
                            <Text style={styles.loginButtonText}>Sign In</Text>
                            <Ionicons name="arrow-forward" size={18} color="#000" />
                        </TouchableOpacity>

                        <View style={styles.dividerContainer}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={styles.appleButton}
                            activeOpacity={0.8}
                            onPress={handleLogin}
                        >
                            <Ionicons name="logo-apple" size={22} color="#FFF" />
                            <Text style={styles.appleButtonText}>Continue with Apple</Text>
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
        backgroundColor: '#000', // Deepest base
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
        borderRadius: 32,
        padding: 40,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)', // Very subtle highlight
        overflow: 'hidden',
    },
    glassPanelIPad: {
        width: 500,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 40,
        elevation: 24,
    },
    glassPanelIPhone: {
        width: '100%',
        maxWidth: 400,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 32,
        zIndex: 10,
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
        backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dark inset pill
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
        color: '#FFF',
        fontSize: 16,
        height: '100%',
    },
    loginButton: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        gap: 8,
    },
    loginButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 8,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    dividerText: {
        color: 'rgba(255, 255, 255, 0.3)',
        marginHorizontal: 16,
        fontSize: 12,
        fontWeight: '600',
    },
    appleButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        gap: 12,
    },
    appleButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '500',
    },
});
