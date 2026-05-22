import React, { useMemo, useState } from 'react';
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
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ReservationCard } from '@/components/ReservationCard';
import { formatServiceDateLabel } from '@/features/host/dateFormat';
import { extractHostRequestErrorMessage } from '@/features/host/errors';
import { useReservationMutations, useReservations } from '@/features/host/hooks';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

function isTerminal(status: string): boolean {
  return status === 'completed' || status === 'canceled' || status === 'no_show';
}

export default function ReservationDayBookScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const selectedDate = date ?? new Date().toISOString().slice(0, 10);
  const router = useRouter();
  const { colors } = useTheme();
  const [includeArchived, setIncludeArchived] = useState(false);
  const query = useReservations({ date: selectedDate, includeArchived });
  const { archiveReservation, restoreReservation } = useReservationMutations();
  const reservations = useMemo(
    () =>
      [...(query.data ?? [])].sort((left, right) => left.timeSlot.localeCompare(right.timeSlot)),
    [query.data],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {formatServiceDateLabel(selectedDate)}
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.muted }]}>
            {reservations.length} reservations
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.accent }]}
          onPress={() =>
            router.push({ pathname: '/reservation-modal/new', params: { date: selectedDate } })
          }
        >
          <Ionicons name="add" size={22} color={colors.white} />
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
        {reservations.map((reservation) => (
          <View key={reservation.id} style={{ opacity: reservation.archivedAt ? 0.55 : 1 }}>
            <ReservationCard
              reservation={reservation}
              onPress={() =>
                router.push({
                  pathname: '/reservation-modal/[id]',
                  params: { id: reservation.id, date: selectedDate },
                } as Href)
              }
            />
            {(isTerminal(reservation.status) || reservation.archivedAt) && (
              <TouchableOpacity
                style={[
                  styles.archiveButton,
                  { backgroundColor: colors.surface.level2, borderColor: colors.glass.border },
                ]}
                onPress={async () => {
                  try {
                    if (reservation.archivedAt) {
                      await restoreReservation({ reservationId: reservation.id });
                    } else {
                      await archiveReservation({ reservationId: reservation.id });
                    }
                  } catch (error) {
                    Alert.alert(
                      'Unable to Update',
                      extractHostRequestErrorMessage(error, 'Reservation could not be updated.'),
                    );
                  }
                }}
              >
                <Text style={[styles.archiveText, { color: colors.text.primary }]}>
                  {reservation.archivedAt ? 'Restore' : 'Archive'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {!query.isLoading && reservations.length === 0 && (
          <Text style={[styles.empty, { color: colors.text.muted }]}>
            No reservations for this date
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { ...textStyles.subtitle },
  subtitle: { ...textStyles.caption, marginTop: spacing.xs },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLine: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleText: { ...textStyles.captionMedium },
  list: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  archiveButton: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  archiveText: { ...textStyles.captionMedium },
  empty: { ...textStyles.body, textAlign: 'center', paddingTop: spacing['3xl'] },
});
