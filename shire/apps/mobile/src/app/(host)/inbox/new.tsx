import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Composer } from '@/components/Composer';
import { extractHostRequestErrorMessage } from '@/features/host/errors';
import { useSendMessage } from '@/features/messaging/hooks';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

function isE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

export default function NewConversationScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [phone, setPhone] = useState('');
  const [body, setBody] = useState('');
  const sendMutation = useSendMessage();

  const handleSend = async () => {
    if (!isE164(phone)) {
      Alert.alert('Invalid Phone', 'Enter an E.164 phone number like +15551212112.');
      return;
    }
    if (!body.trim()) {
      Alert.alert('Message Required', 'Enter a message before sending.');
      return;
    }

    try {
      const response = await sendMutation.mutateAsync({ phone: phone.trim(), body: body.trim() });
      router.replace(`/(host)/inbox/${response.conversation.id}` as Href);
    } catch (error) {
      Alert.alert(
        'Unable to Send',
        extractHostRequestErrorMessage(error, 'Message could not be sent.'),
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text.primary }]}>New Conversation</Text>
          <View style={styles.iconButton} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.label, { color: colors.text.primary }]}>Phone</Text>
          <TextInput
            style={[styles.input, { color: colors.text.primary, borderColor: colors.glass.border }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="+15551212112"
            placeholderTextColor={colors.text.muted}
            keyboardType="phone-pad"
          />
        </View>
        <View style={styles.spacer} />
        <Composer
          value={body}
          onChangeText={setBody}
          onSend={() => void handleSend()}
          isSending={sendMutation.isPending}
          placeholder="First message"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...textStyles.subtitle },
  content: { padding: spacing.xl, gap: spacing.sm },
  label: { ...textStyles.captionMedium },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...textStyles.body,
  },
  spacer: { flex: 1 },
});
