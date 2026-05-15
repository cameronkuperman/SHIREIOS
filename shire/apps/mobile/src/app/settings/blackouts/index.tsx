import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { extractHostRequestErrorMessage } from '@/features/host/errors';
import { useArchiveBlackout, useBlackouts, useRestoreBlackout } from '@/features/blackouts/hooks';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

export default function BlackoutsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [includeArchived, setIncludeArchived] = useState(false);
  const query = useBlackouts(includeArchived);
  const archiveMutation = useArchiveBlackout();
  const restoreMutation = useRestoreBlackout();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>Blackouts</Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push('/settings/blackouts/new' as Href)}
        >
          <Ionicons name="add" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.toggleLine}>
        <TouchableOpacity
          style={styles.toggle}
          onPress={() => setIncludeArchived((current) => !current)}
        >
          <Ionicons
            name={includeArchived ? 'checkbox' : 'square-outline'}
            size={18}
            color={colors.accent}
          />
          <Text style={[styles.toggleText, { color: colors.text.primary }]}>Show archived</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {query.isLoading && <ActivityIndicator color={colors.accent} />}
        {(query.data ?? []).map((blackout) => (
          <TouchableOpacity
            key={blackout.id}
            style={[
              styles.row,
              {
                backgroundColor: colors.surface.level1,
                borderColor: colors.glass.border,
                opacity: blackout.archivedAt ? 0.6 : 1,
              },
            ]}
            onPress={() => router.push(`/settings/blackouts/${blackout.id}` as Href)}
          >
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: colors.text.primary }]}>{blackout.name}</Text>
              <Text style={[styles.meta, { color: colors.text.muted }]}>
                {blackout.startsAt} to {blackout.endsAt}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.smallButton, { backgroundColor: colors.surface.level2 }]}
              onPress={async () => {
                try {
                  if (blackout.archivedAt) {
                    await restoreMutation.mutateAsync(blackout.id);
                  } else {
                    await archiveMutation.mutateAsync({ blackoutId: blackout.id });
                  }
                } catch (error) {
                  Alert.alert(
                    'Unable to Update',
                    extractHostRequestErrorMessage(error, 'Blackout could not be updated.'),
                  );
                }
              }}
            >
              <Text style={[styles.smallButtonText, { color: colors.text.primary }]}>
                {blackout.archivedAt ? 'Restore' : 'Archive'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
        {!query.isLoading && (query.data ?? []).length === 0 && (
          <Text style={[styles.empty, { color: colors.text.muted }]}>
            No blackouts. Create one to block a date or time window.
          </Text>
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
  toggleLine: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleText: { ...textStyles.captionMedium },
  list: { padding: spacing.xl, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  rowText: { flex: 1, paddingRight: spacing.md },
  name: { ...textStyles.label },
  meta: { ...textStyles.caption, marginTop: spacing.xs },
  smallButton: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  smallButtonText: { ...textStyles.captionMedium },
  empty: { ...textStyles.body, textAlign: 'center', paddingTop: spacing['3xl'] },
});
