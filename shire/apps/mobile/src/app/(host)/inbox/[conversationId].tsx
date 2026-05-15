import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Composer } from '@/components/Composer';
import { MessageBubble } from '@/components/MessageBubble';
import { TemplatePickerSheet } from '@/components/TemplatePickerSheet';
import { useAuth } from '@/features/auth';
import { useComposerStore } from '@/features/messaging/composerStore';
import {
  useConversation,
  useMarkRead,
  useSendMessage,
  useTemplates,
} from '@/features/messaging/hooks';
import { spacing, textStyles, useTheme } from '@/theme';

export default function ConversationScreen() {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { currentLocation } = useAuth();
  const { colors } = useTheme();
  const query = useConversation(conversationId ?? null);
  const templatesQuery = useTemplates();
  const sendMutation = useSendMessage();
  const { mutate: markConversationRead } = useMarkRead();
  const draft = useComposerStore((state) => state.drafts[conversationId ?? ''] ?? '');
  const setDraft = useComposerStore((state) => state.setDraft);
  const clearDraft = useComposerStore((state) => state.clearDraft);
  const [pickerOpen, setPickerOpen] = useState(false);
  const conversation = query.data?.conversation ?? null;
  const messages = query.data?.messages ?? [];

  useEffect(() => {
    if (conversation?.unreadCount) {
      markConversationRead(conversation.id);
    }
  }, [conversation?.id, conversation?.unreadCount, markConversationRead]);

  const handleSend = async () => {
    if (!conversationId || !draft.trim()) {
      return;
    }
    await sendMutation.mutateAsync({ conversationId, body: draft.trim() });
    clearDraft(conversationId);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={1}>
              {conversation?.displayName ?? 'Conversation'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.text.muted }]} numberOfLines={1}>
              {conversation?.guestId
                ? conversation.phoneE164
                : `Unknown guest · ${conversation?.phoneE164 ?? ''}`}
            </Text>
          </View>
        </View>
        {query.isLoading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
        <ScrollView contentContainerStyle={styles.messages}>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onRetry={(payload) => sendMutation.mutate(payload)}
            />
          ))}
        </ScrollView>
        <Composer
          value={draft}
          onChangeText={(value) => conversationId && setDraft(conversationId, value)}
          onOpenTemplates={() => setPickerOpen(true)}
          onSend={() => void handleSend()}
          isSending={sendMutation.isPending}
        />
        <TemplatePickerSheet
          visible={pickerOpen}
          templates={templatesQuery.data ?? []}
          context={{ restaurantName: currentLocation?.name, messageBody: draft }}
          onClose={() => setPickerOpen(false)}
          onSelect={(_, preview) => {
            if (conversationId) {
              setDraft(conversationId, preview);
            }
            setPickerOpen(false);
          }}
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
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { ...textStyles.subtitle },
  subtitle: { ...textStyles.caption, marginTop: spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messages: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
});
