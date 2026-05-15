import React, { useMemo } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TemplateForm } from '@/components/TemplateForm';
import { extractHostRequestErrorMessage } from '@/features/host/errors';
import { useTemplates, useUpdateTemplate } from '@/features/messaging/hooks';
import { spacing, textStyles, useTheme } from '@/theme';

export default function EditTemplateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const templates = useTemplates();
  const mutation = useUpdateTemplate();
  const template = useMemo(
    () => (templates.data ?? []).find((entry) => entry.id === id) ?? null,
    [id, templates.data],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>Edit Template</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {template ? (
          <TemplateForm
            template={template}
            isSaving={mutation.isPending}
            onSubmit={async (values) => {
              try {
                await mutation.mutateAsync({ templateId: template.id, input: values });
                router.back();
              } catch (error) {
                Alert.alert(
                  'Unable to Save',
                  extractHostRequestErrorMessage(error, 'Template could not be saved.'),
                );
              }
            }}
          />
        ) : (
          <Text style={[styles.empty, { color: colors.text.muted }]}>Template not found</Text>
        )}
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
  empty: { ...textStyles.body, textAlign: 'center', paddingTop: spacing['3xl'] },
});
