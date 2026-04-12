import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { AddPartyModal } from '@/components/AddPartyModal';
import { CalendarGrid } from '@/components/CalendarGrid';
import { ReservationCard } from '@/components/ReservationCard';
import { WaitlistCard } from '@/components/WaitlistCard';
import { useAuth } from '@/features/auth';
import {
  useActiveWaitlistEntries,
  useReservationDayBook,
  useReservationMutations,
  useWaitlistMutations,
  waitlistToSidebarParty,
} from '@/features/host/hooks';
import type { ReservationStatus } from '@shire/shared';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

type QueueTab = 'waitlist' | 'reservations';

const RESERVATION_FILTERS: Array<{ key: ReservationStatus | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'booked', label: 'Booked' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'checked_in', label: 'Checked In' },
  { key: 'seated', label: 'Seated' },
  { key: 'canceled', label: 'Canceled' },
  { key: 'no_show', label: 'No Show' },
];

export default function WaitlistScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentLocation } = useAuth();
  const waitlistEntries = useActiveWaitlistEntries();
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const reservationBook = useReservationDayBook(selectedDate);
  const { createWaitlistEntry, runWaitlistAction, isSaving: isWaitlistSaving } = useWaitlistMutations();
  const { runReservationAction, isSaving: isReservationSaving } = useReservationMutations();
  const isSaving = isWaitlistSaving || isReservationSaving;
  const [activeTab, setActiveTab] = useState<QueueTab>('waitlist');
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');

  const waitlistCards = useMemo(
    () => waitlistEntries.map(waitlistToSidebarParty),
    [waitlistEntries],
  );
  const selectedEntry = waitlistEntries.find((entry) => entry.id === selectedPartyId) ?? null;
  const filteredReservations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return reservationBook.filter((reservation) => {
      if (statusFilter !== 'all' && reservation.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        reservation.guestName.toLowerCase().includes(normalizedSearch) ||
        reservation.guestPhone.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [reservationBook, search, statusFilter]);
  const selectedReservation =
    filteredReservations.find((reservation) => reservation.id === selectedPartyId) ?? null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text.primary }]}>Queue</Text>
          {currentLocation && (
            <Text style={[styles.subtitle, { color: colors.text.muted }]}>
              {currentLocation.name}
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: colors.surface.level2,
                borderColor: colors.glass.border,
              },
            ]}
          >
            <Text style={[styles.countText, { color: colors.text.secondary }]}>
              {activeTab === 'waitlist'
                ? `${waitlistCards.length} parties`
                : `${filteredReservations.length} reservations`}
            </Text>
          </View>
          {activeTab === 'reservations' && (
            <TouchableOpacity
              style={[
                styles.calendarBtn,
                {
                  backgroundColor: colors.surface.level2,
                  borderColor: colors.glass.border,
                },
              ]}
              activeOpacity={0.7}
              onPress={() => setShowCalendar((current) => !current)}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.text.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.accent }]}
            activeOpacity={0.7}
            onPress={() => {
              if (activeTab === 'waitlist') {
                setShowAddModal(true);
                return;
              }

              router.push({
                pathname: '/reservation-modal/new',
                params: { date: selectedDate },
              });
            }}
          >
            <Ionicons name="add" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.segmentRow}>
        {(['waitlist', 'reservations'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.segmentButton,
                {
                  backgroundColor: isActive ? colors.accentLight : colors.surface.level2,
                  borderColor: isActive ? colors.accent : colors.glass.borderSubtle,
                },
              ]}
              onPress={() => {
                setActiveTab(tab);
                setSelectedPartyId(null);
              }}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: isActive ? colors.accent : colors.text.secondary },
                ]}
              >
                {tab === 'waitlist' ? 'Waitlist' : 'Reservations'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'reservations' && (
        <>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: colors.surface.level1, borderColor: colors.glass.border },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={colors.text.muted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text.primary }]}
              placeholder="Search name or phone"
              placeholderTextColor={colors.text.muted}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {RESERVATION_FILTERS.map((filter) => {
              const isActive = statusFilter === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? colors.accentLight : colors.surface.level2,
                      borderColor: isActive ? colors.accent : colors.glass.borderSubtle,
                    },
                  ]}
                  onPress={() => setStatusFilter(filter.key)}
                >
                  <Text
                    style={[
                      styles.filterLabel,
                      { color: isActive ? colors.accent : colors.text.secondary },
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {showCalendar && (
            <View
              style={[
                styles.calendarCard,
                { backgroundColor: colors.surface.level1, borderColor: colors.glass.border },
              ]}
            >
              <CalendarGrid
                selectedDate={new Date(`${selectedDate}T12:00:00`)}
                currentMonth={currentMonth}
                onSelectDate={(date) => setSelectedDate(format(date, 'yyyy-MM-dd'))}
                onChangeMonth={setCurrentMonth}
              />
            </View>
          )}
        </>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'waitlist'
          ? waitlistCards.map((party, index) => (
              <Animated.View key={party.id} entering={FadeIn.delay(index * 40).duration(220)}>
                <WaitlistCard
                  party={party}
                  index={index}
                  isSelected={selectedPartyId === party.id}
                  onPress={() => setSelectedPartyId(selectedPartyId === party.id ? null : party.id)}
                />
              </Animated.View>
            ))
          : filteredReservations.map((reservation, index) => (
              <Animated.View key={reservation.id} entering={FadeIn.delay(index * 30).duration(220)}>
                <ReservationCard
                  reservation={reservation}
                  onPress={() =>
                    setSelectedPartyId(
                      selectedPartyId === reservation.id ? null : reservation.id,
                    )
                  }
                />
              </Animated.View>
            ))}

        {activeTab === 'waitlist' && waitlistCards.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="person-add-outline" size={42} color={colors.text.muted} />
            <Text style={[styles.emptyText, { color: colors.text.muted }]}>
              No active waitlist entries
            </Text>
          </View>
        )}

        {activeTab === 'reservations' && filteredReservations.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-clear-outline" size={42} color={colors.text.muted} />
            <Text style={[styles.emptyText, { color: colors.text.muted }]}>
              No reservations in this view
            </Text>
          </View>
        )}
      </ScrollView>

      {activeTab === 'waitlist' && selectedEntry && (
        <View
          style={[
            styles.actionBar,
            {
              backgroundColor: colors.surface.level1,
              borderTopColor: colors.border.subtle,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface.level3 }]}
            onPress={() =>
              void runWaitlistAction({ waitlistEntryId: selectedEntry.id, action: 'arrive' })
            }
            disabled={isSaving || selectedEntry.status === 'arrived'}
          >
            <Ionicons name="walk-outline" size={18} color={colors.text.primary} />
            <Text style={[styles.actionText, { color: colors.text.primary }]}>Arrived</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface.level3 }]}
            onPress={() =>
              void runWaitlistAction({ waitlistEntryId: selectedEntry.id, action: 'mark_no_show' })
            }
            disabled={isSaving}
          >
            <Ionicons name="moon-outline" size={18} color={colors.text.primary} />
            <Text style={[styles.actionText, { color: colors.text.primary }]}>No Show</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.status.dirty.fill }]}
            onPress={() =>
              void runWaitlistAction({ waitlistEntryId: selectedEntry.id, action: 'remove' })
            }
            disabled={isSaving}
          >
            <Ionicons name="trash-outline" size={18} color={colors.status.dirty.text} />
            <Text style={[styles.actionText, { color: colors.status.dirty.text }]}>Remove</Text>
          </TouchableOpacity>
          {isSaving && <ActivityIndicator color={colors.accent} />}
        </View>
      )}

      {activeTab === 'reservations' && selectedReservation && (
        <View
          style={[
            styles.actionBar,
            {
              backgroundColor: colors.surface.level1,
              borderTopColor: colors.border.subtle,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface.level3 }]}
            onPress={() =>
              router.push({
                pathname: '/reservation-modal/[id]',
                params: { id: selectedReservation.id, date: selectedDate },
              })
            }
          >
            <Ionicons name="create-outline" size={18} color={colors.text.primary} />
            <Text style={[styles.actionText, { color: colors.text.primary }]}>Open</Text>
          </TouchableOpacity>
          {selectedReservation.status === 'booked' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface.level3 }]}
              onPress={() =>
                void runReservationAction({
                  reservationId: selectedReservation.id,
                  action: 'confirm',
                })
              }
            >
              <Ionicons name="checkmark-outline" size={18} color={colors.text.primary} />
              <Text style={[styles.actionText, { color: colors.text.primary }]}>Confirm</Text>
            </TouchableOpacity>
          )}
          {['booked', 'confirmed'].includes(selectedReservation.status) && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface.level3 }]}
              onPress={() =>
                void runReservationAction({
                  reservationId: selectedReservation.id,
                  action: 'arrive',
                })
              }
            >
              <Ionicons name="walk-outline" size={18} color={colors.text.primary} />
              <Text style={[styles.actionText, { color: colors.text.primary }]}>Arrive</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface.level3 }]}
            onPress={() =>
              void runReservationAction({
                reservationId: selectedReservation.id,
                action: 'mark_no_show',
              })
            }
          >
            <Ionicons name="moon-outline" size={18} color={colors.text.primary} />
            <Text style={[styles.actionText, { color: colors.text.primary }]}>No Show</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.status.dirty.fill }]}
            onPress={() =>
              void runReservationAction({
                reservationId: selectedReservation.id,
                action: 'cancel',
              })
            }
          >
            <Ionicons name="close-outline" size={18} color={colors.status.dirty.text} />
            <Text style={[styles.actionText, { color: colors.status.dirty.text }]}>Cancel</Text>
          </TouchableOpacity>
          {isSaving && <ActivityIndicator color={colors.accent} />}
        </View>
      )}

      <AddPartyModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={async (data) => {
          await createWaitlistEntry({
            guestName: data.name,
            guestPhone: data.phone,
            partySize: data.size,
            seatingPreference: data.seatingPreference,
            notes: '',
            source: 'manual',
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
  },
  title: {
    ...textStyles.title,
  },
  subtitle: {
    ...textStyles.caption,
    marginTop: spacing.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing.md,
  },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  segmentText: {
    ...textStyles.captionMedium,
  },
  countBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  countText: {
    ...textStyles.captionMedium,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    marginHorizontal: spacing['2xl'],
    marginBottom: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...textStyles.body,
  },
  filterRow: {
    paddingHorizontal: spacing['2xl'],
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  filterChip: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterLabel: {
    ...textStyles.captionMedium,
  },
  calendarCard: {
    marginHorizontal: spacing['2xl'],
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    paddingVertical: spacing.md,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  emptyState: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    ...textStyles.body,
  },
  actionBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    ...textStyles.captionMedium,
  },
});
