import React from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useTemplates } from '@/features/messaging/hooks';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

export default function TemplatesSettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const query = useTemplates();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>Templates</Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push('/settings/templates/new' as Href)}
        >
          <Ionicons name="add" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {query.isLoading && <ActivityIndicator color={colors.accent} />}
        {(query.data ?? []).map((template) => (
          <TouchableOpacity
            key={template.id}
            style={[
              styles.row,
              {
                backgroundColor: colors.surface.level1,
                borderColor: colors.glass.border,
                opacity: template.active ? 1 : 0.55,
              },
            ]}
            onPress={() => router.push(`/settings/templates/${template.id}` as Href)}
          >
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: colors.text.primary }]}>{template.name}</Text>
              <Text style={[styles.meta, { color: colors.text.muted }]}>
                {template.category} · {template.key}
              </Text>
            </View>
            {template.systemDefault && (
              <Text style={[styles.pill, { color: colors.accent }]}>Default</Text>
            )}
          </TouchableOpacity>
        ))}
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
  list: { padding: spacing.xl, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  rowText: { flex: 1 },
  name: { ...textStyles.label },
  meta: { ...textStyles.caption, marginTop: spacing.xs, textTransform: 'capitalize' },
  pill: { ...textStyles.tiny, textTransform: 'uppercase', fontWeight: '700' },
});
