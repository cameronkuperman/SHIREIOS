import React, { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useRouter, type Href } from 'expo-router';
import { ReservationCalendar } from '@/components/ReservationCalendar';
import { useReservationDensity } from '@/features/host/hooks';
import { spacing, textStyles, useTheme } from '@/theme';

export default function ReservationsCalendarScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [month, setMonth] = useState(() => new Date());
  const range = useMemo(
    () => ({
      dateFrom: format(startOfMonth(month), 'yyyy-MM-dd'),
      dateTo: format(endOfMonth(month), 'yyyy-MM-dd'),
      includeArchived: false,
    }),
    [month],
  );
  const density = useReservationDensity(range);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text.primary }]}>Reservations</Text>
          <Text style={[styles.subtitle, { color: colors.text.muted }]}>Calendar view</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/settings' as Href)}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() =>
              router.push(`/(host)/reservations/${format(new Date(), 'yyyy-MM-dd')}` as Href)
            }
          >
            <Ionicons name="today-outline" size={22} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.content}>
        <ReservationCalendar
          month={month}
          densityDays={density.data?.days ?? []}
          onChangeMonth={setMonth}
          onSelectDate={(date) => router.push(`/(host)/reservations/${date}` as Href)}
        />
        {density.error && (
          <Text style={[styles.error, { color: colors.text.muted }]}>
            Density is unavailable. Day books still open normally.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.xl,
  },
  title: { ...textStyles.title },
  subtitle: { ...textStyles.caption, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl },
  error: { ...textStyles.caption, marginTop: spacing.lg, textAlign: 'center' },
});
