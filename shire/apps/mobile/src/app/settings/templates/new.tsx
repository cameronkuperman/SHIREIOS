import React from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { CreateMessageTemplateRequest } from '@shire/shared';
import { TemplateForm } from '@/components/TemplateForm';
import { extractHostRequestErrorMessage } from '@/features/host/errors';
import { useCreateTemplate } from '@/features/messaging/hooks';
import { spacing, textStyles, useTheme } from '@/theme';

export default function NewTemplateScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const mutation = useCreateTemplate();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>New Template</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <TemplateForm
          isSaving={mutation.isPending}
          onSubmit={async (values) => {
            try {
              await mutation.mutateAsync(values as CreateMessageTemplateRequest);
              router.back();
            } catch (error) {
              Alert.alert(
                'Unable to Save',
                extractHostRequestErrorMessage(error, 'Template could not be saved.'),
              );
            }
          }}
        />
      </ScrollView>
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
  content: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
});
