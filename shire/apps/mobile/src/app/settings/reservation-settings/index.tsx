import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useReservationSettings } from '@/features/host/hooks';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

export default function ReservationSettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const settings = useReservationSettings();
  const rows = settings
    ? Object.entries(settings).map(
        ([key, value]) => [key, value == null ? 'None' : String(value)] as const,
      )
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>Reservation Settings</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {rows.map(([key, value]) => (
          <View
            key={key}
            style={[
              styles.row,
              { backgroundColor: colors.surface.level1, borderColor: colors.glass.border },
            ]}
          >
            <Text style={[styles.key, { color: colors.text.muted }]}>{key}</Text>
            <Text style={[styles.value, { color: colors.text.primary }]}>{value}</Text>
          </View>
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
  content: { padding: spacing.xl, gap: spacing.sm },
  row: { borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.lg, gap: spacing.xs },
  key: { ...textStyles.tiny, textTransform: 'uppercase' },
  value: { ...textStyles.body },
});
