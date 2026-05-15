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
import { BlackoutForm } from '@/components/BlackoutForm';
import {
  useArchiveBlackout,
  useBlackouts,
  useRestoreBlackout,
  useUpdateBlackout,
} from '@/features/blackouts/hooks';
import { extractHostRequestErrorMessage } from '@/features/host/errors';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

export default function EditBlackoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const blackouts = useBlackouts(true);
  const updateMutation = useUpdateBlackout();
  const archiveMutation = useArchiveBlackout();
  const restoreMutation = useRestoreBlackout();
  const blackout = useMemo(
    () => (blackouts.data ?? []).find((entry) => entry.id === id) ?? null,
    [blackouts.data, id],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>Edit Blackout</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {blackout ? (
          <>
            <BlackoutForm
              blackout={blackout}
              isSaving={updateMutation.isPending}
              onSubmit={async (values) => {
                try {
                  await updateMutation.mutateAsync({ blackoutId: blackout.id, input: values });
                  router.back();
                } catch (error) {
                  Alert.alert(
                    'Unable to Save',
                    extractHostRequestErrorMessage(error, 'Blackout could not be saved.'),
                  );
                }
              }}
            />
            <TouchableOpacity
              style={[
                styles.archiveButton,
                { backgroundColor: colors.surface.level2, borderColor: colors.glass.border },
              ]}
              onPress={async () => {
                try {
                  if (blackout.archivedAt) {
                    await restoreMutation.mutateAsync(blackout.id);
                  } else {
                    await archiveMutation.mutateAsync({ blackoutId: blackout.id });
                  }
                  router.back();
                } catch (error) {
                  Alert.alert(
                    'Unable to Update',
                    extractHostRequestErrorMessage(error, 'Blackout could not be updated.'),
                  );
                }
              }}
            >
              <Text style={[styles.archiveText, { color: colors.text.primary }]}>
                {blackout.archivedAt ? 'Restore Blackout' : 'Archive Blackout'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={[styles.empty, { color: colors.text.muted }]}>Blackout not found</Text>
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
  content: { padding: spacing.xl, paddingBottom: spacing['3xl'], gap: spacing.lg },
  archiveButton: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  archiveText: { ...textStyles.label },
  empty: { ...textStyles.body, textAlign: 'center', paddingTop: spacing['3xl'] },
});
