import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { HostPersonDetailSheet } from '@/components/HostPersonDetailSheet';
import { ReservationCard } from '@/components/ReservationCard';
import { WaitlistCard } from '@/components/WaitlistCard';
import { WaitlistNotifySheet } from '@/components/WaitlistNotifySheet';
import { useAuth } from '@/features/auth';
import { fireHostMutation } from '@/features/host/backgroundMutation';
import { extractHostRequestErrorMessage } from '@/features/host/errors';
import {
  useActiveWaitlistEntries,
  useReservationDayBook,
  useReservationMutations,
  useWaitlist,
  useWaitlistMutations,
  waitlistToSidebarParty,
  type HostSidebarParty,
} from '@/features/host/hooks';
import { useTemplates, useWaitlistNotify } from '@/features/messaging/hooks';
import type { Reservation, ReservationStatus } from '@shire/shared';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

type QueueItemSource = 'waitlist' | 'reservations';
type QueueTab = 'all' | QueueItemSource;
type QueueDetailTarget = { source: QueueItemSource; id: string } | null;

const QUEUE_TABS: {
  key: QueueTab;
  label: string;
  icon: 'layers-outline' | 'people-outline' | 'calendar-outline';
}[] = [
  { key: 'all', label: 'All', icon: 'layers-outline' },
  { key: 'waitlist', label: 'Waitlist', icon: 'people-outline' },
  { key: 'reservations', label: 'Reservations', icon: 'calendar-outline' },
];

const RESERVATION_FILTERS: { key: ReservationStatus | 'all'; label: string }[] = [
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
  const waitlistQuery = useWaitlist();
  const waitlistEntries = useActiveWaitlistEntries();
  const templatesQuery = useTemplates();
  const waitlistNotify = useWaitlistNotify();
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const reservationBook = useReservationDayBook(selectedDate);
  const {
    createWaitlistEntry,
    updateWaitlistEntry,
    runWaitlistAction,
    isSaving: isWaitlistSaving,
  } = useWaitlistMutations();
  const {
    updateReservation,
    runReservationAction,
    isSaving: isReservationSaving,
  } = useReservationMutations();
  const isSaving = isWaitlistSaving || isReservationSaving;
  const [activeTab, setActiveTab] = useState<QueueTab>('waitlist');
  const [detailTarget, setDetailTarget] = useState<QueueDetailTarget>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
  const [notifyEntryId, setNotifyEntryId] = useState<string | null>(null);

  const waitlistCards = useMemo(
    () => waitlistEntries.map(waitlistToSidebarParty),
    [waitlistEntries],
  );
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
  type QueueAllItem =
    | { kind: 'waitlist'; id: string; sortKey: number; party: HostSidebarParty }
    | { kind: 'reservation'; id: string; sortKey: number; reservation: Reservation };
  const allItems = useMemo<QueueAllItem[]>(() => {
    const items: QueueAllItem[] = [];
    waitlistEntries.forEach((entry, index) => {
      const card = waitlistCards[index];
      if (!card) return;
      items.push({
        kind: 'waitlist',
        id: entry.id,
        sortKey: Date.parse(entry.joinedAt) || 0,
        party: card,
      });
    });
    filteredReservations.forEach((reservation) => {
      items.push({
        kind: 'reservation',
        id: reservation.id,
        sortKey: Date.parse(`${selectedDate}T${reservation.timeSlot}:00`) || 0,
        reservation,
      });
    });
    return items.sort((a, b) => a.sortKey - b.sortKey);
  }, [waitlistEntries, waitlistCards, filteredReservations, selectedDate]);

  const selectedEntry =
    detailTarget?.source === 'waitlist'
      ? (waitlistEntries.find((entry) => entry.id === detailTarget.id) ?? null)
      : null;
  const selectedReservation =
    detailTarget?.source === 'reservations'
      ? (filteredReservations.find((reservation) => reservation.id === detailTarget.id) ?? null)
      : null;
  const waitlistErrorMessage = waitlistQuery.error
    ? extractHostRequestErrorMessage(
        waitlistQuery.error,
        'The waitlist could not be loaded. Pull to refresh or try again shortly.',
      )
    : null;

  useEffect(() => {
    if (!detailTarget) {
      return;
    }

    if (detailTarget.source === 'waitlist' && !selectedEntry) {
      setDetailTarget(null);
      return;
    }

    if (detailTarget.source === 'reservations' && !selectedReservation) {
      setDetailTarget(null);
    }
  }, [detailTarget, selectedEntry, selectedReservation]);

  const handleWaitlistAction = async (
    waitlistEntryId: string,
    action: Parameters<typeof runWaitlistAction>[0]['action'],
  ) => {
    try {
      await runWaitlistAction({ waitlistEntryId, action });
    } catch (error) {
      Alert.alert(
        'Unable to Update Waitlist',
        extractHostRequestErrorMessage(error, 'The waitlist entry could not be updated.'),
      );
    }
  };

  const handleReservationAction = async (
    reservationId: string,
    action: Parameters<typeof runReservationAction>[0]['action'],
  ) => {
    try {
      await runReservationAction({ reservationId, action });
    } catch (error) {
      Alert.alert(
        'Unable to Update Reservation',
        extractHostRequestErrorMessage(error, 'The reservation could not be updated.'),
      );
    }
  };

  const renderWaitlistCard = (party: HostSidebarParty, index: number) => (
    <Animated.View key={party.id} entering={FadeIn.delay(index * 40).duration(220)}>
      <WaitlistCard
        party={party}
        index={index}
        isSelected={detailTarget?.source === 'waitlist' && detailTarget.id === party.id}
        onPress={() => setDetailTarget({ source: 'waitlist', id: party.id })}
        isNotifying={waitlistNotify.isPending}
        onNotify={async () => {
          try {
            await waitlistNotify.mutateAsync({
              entryId: party.id,
              input: { templateKey: 'waitlist_ready' },
            });
          } catch (error) {
            Alert.alert(
              'Unable to Notify',
              extractHostRequestErrorMessage(error, 'The guest could not be notified.'),
            );
          }
        }}
        onNotifyMore={() => setNotifyEntryId(party.id)}
        onMessage={() =>
          router.push({
            pathname: '/(host)/inbox/new',
            params: {
              waitlistId: party.id,
              guestName: party.name,
              phone: party.phone,
            },
          })
        }
        onCall={() => {
          if (party.phone?.trim()) {
            void Linking.openURL(`tel:${party.phone.trim()}`);
          }
        }}
      />
    </Animated.View>
  );

  const renderReservationCard = (reservation: Reservation, index: number) => (
    <Animated.View key={reservation.id} entering={FadeIn.delay(index * 30).duration(220)}>
      <ReservationCard
        reservation={reservation}
        isSelected={detailTarget?.source === 'reservations' && detailTarget.id === reservation.id}
        onPress={() => setDetailTarget({ source: 'reservations', id: reservation.id })}
        onMessage={() =>
          router.push({
            pathname: '/(host)/inbox/new',
            params: {
              reservationId: reservation.id,
              guestId: reservation.guestId ?? undefined,
              guestName: reservation.guestName,
              phone: reservation.guestPhone,
            },
          })
        }
        onCall={() => {
          if (reservation.guestPhone.trim()) {
            void Linking.openURL(`tel:${reservation.guestPhone.trim()}`);
          }
        }}
      />
    </Animated.View>
  );

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
              {activeTab === 'all'
                ? `${allItems.length} waiting`
                : activeTab === 'waitlist'
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
            testID="queue-add-button"
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

      <View style={styles.queueWorkspace}>
        <View
          style={[
            styles.queuePanel,
            { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
          ]}
        >
          <Text style={[styles.panelEyebrow, { color: colors.text.muted }]}>Live book</Text>
          {QUEUE_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count =
              tab.key === 'all'
                ? allItems.length
                : tab.key === 'waitlist'
                  ? waitlistCards.length
                  : filteredReservations.length;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.queueSwitch,
                  {
                    backgroundColor: isActive ? colors.accentLight : colors.surface.level2,
                    borderColor: isActive ? colors.accent : colors.border.subtle,
                  },
                ]}
                onPress={() => {
                  setActiveTab(tab.key);
                  setDetailTarget(null);
                }}
              >
                <View style={styles.queueSwitchIcon}>
                  <Ionicons
                    name={tab.icon}
                    size={19}
                    color={isActive ? colors.accent : colors.text.secondary}
                  />
                </View>
                <View style={styles.queueSwitchText}>
                  <Text
                    style={[
                      styles.segmentText,
                      { color: isActive ? colors.accent : colors.text.primary },
                    ]}
                  >
                    {tab.label}
                  </Text>
                  <Text style={[styles.switchSubtext, { color: colors.text.muted }]}>
                    {count} active
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {activeTab === 'reservations' && (
            <>
              <TouchableOpacity
                style={[
                  styles.dateButton,
                  { backgroundColor: colors.surface.level2, borderColor: colors.border.subtle },
                ]}
                activeOpacity={0.76}
                onPress={() => setShowCalendar((current) => !current)}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.text.secondary} />
                <Text style={[styles.dateButtonText, { color: colors.text.primary }]}>
                  {selectedDate}
                </Text>
              </TouchableOpacity>
              <View
                style={[
                  styles.searchBar,
                  { backgroundColor: colors.surface.level2, borderColor: colors.border.subtle },
                ]}
              >
                <Ionicons name="search-outline" size={18} color={colors.text.muted} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text.primary }]}
                  placeholder="Search guest"
                  placeholderTextColor={colors.text.muted}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
              <View style={styles.filterGrid}>
                {RESERVATION_FILTERS.map((filter) => {
                  const isActive = statusFilter === filter.key;
                  return (
                    <TouchableOpacity
                      key={filter.key}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: isActive ? colors.accentLight : colors.surface.level2,
                          borderColor: isActive ? colors.accent : colors.border.subtle,
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
              </View>
            </>
          )}
        </View>

        <View
          style={[
            styles.queueBoard,
            { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
          ]}
        >
          <View style={styles.boardHeader}>
            <View>
              <Text style={[styles.boardTitle, { color: colors.text.primary }]}>
                {activeTab === 'all'
                  ? 'All waiting'
                  : activeTab === 'waitlist'
                    ? 'Waiting parties'
                    : 'Reservation book'}
              </Text>
              <Text style={[styles.boardSubtitle, { color: colors.text.muted }]}>
                {activeTab === 'all'
                  ? 'Waitlist and reservations together, by time.'
                  : activeTab === 'waitlist'
                    ? 'Notify, inspect, and move parties to the floor.'
                    : 'Search by guest and filter by arrival state.'}
              </Text>
            </View>
            {activeTab === 'reservations' && (
              <TouchableOpacity
                style={[
                  styles.calendarBtn,
                  {
                    backgroundColor: colors.surface.level2,
                    borderColor: colors.border.subtle,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => setShowCalendar((current) => !current)}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.text.primary} />
              </TouchableOpacity>
            )}
          </View>

          {activeTab === 'reservations' && showCalendar && (
            <View
              style={[
                styles.calendarCard,
                { backgroundColor: colors.surface.level2, borderColor: colors.border.subtle },
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

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'waitlist' &&
              waitlistCards.map((party, index) => renderWaitlistCard(party, index))}

            {activeTab === 'reservations' &&
              filteredReservations.map((reservation, index) =>
                renderReservationCard(reservation, index),
              )}

            {activeTab === 'all' &&
              allItems.map((item, index) =>
                item.kind === 'waitlist'
                  ? renderWaitlistCard(item.party, index)
                  : renderReservationCard(item.reservation, index),
              )}

            {activeTab === 'all' && allItems.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="layers-outline" size={42} color={colors.text.muted} />
                <Text style={[styles.emptyText, { color: colors.text.muted }]}>
                  No parties waiting.
                </Text>
              </View>
            )}

            {activeTab === 'waitlist' && waitlistQuery.isLoading && waitlistCards.length === 0 && (
              <View style={styles.emptyState}>
                <ActivityIndicator color={colors.accent} />
                <Text style={[styles.emptyText, { color: colors.text.muted }]}>
                  Loading waitlist...
                </Text>
              </View>
            )}

            {activeTab === 'waitlist' && waitlistErrorMessage && !waitlistQuery.isLoading && (
              <View style={styles.emptyState}>
                <Ionicons name="alert-circle-outline" size={42} color={colors.status.dirty.text} />
                <Text style={[styles.emptyText, { color: colors.status.dirty.text }]}>
                  {waitlistErrorMessage}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.retryButton,
                    {
                      backgroundColor: colors.surface.level2,
                      borderColor: colors.glass.border,
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    void waitlistQuery.refetch();
                  }}
                >
                  <Text style={[styles.retryButtonText, { color: colors.text.primary }]}>
                    Retry
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'waitlist' &&
              !waitlistQuery.isLoading &&
              !waitlistErrorMessage &&
              waitlistCards.length === 0 && (
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
        </View>
      </View>

      <HostPersonDetailSheet
        visible={Boolean(selectedEntry || selectedReservation)}
        waitlistEntry={selectedEntry}
        reservation={selectedReservation}
        isSaving={isSaving}
        onClose={() => setDetailTarget(null)}
        onSaveWaitlist={async (waitlistEntryId, input) => {
          try {
            await updateWaitlistEntry({ waitlistEntryId, input });
          } catch (error) {
            throw new Error(
              extractHostRequestErrorMessage(error, 'The waitlist entry could not be updated.'),
            );
          }
        }}
        onRunWaitlistAction={async (waitlistEntryId, action) => {
          await handleWaitlistAction(waitlistEntryId, action);
        }}
        onSaveReservation={async (reservationId, input) => {
          try {
            await updateReservation({ reservationId, input });
          } catch (error) {
            throw new Error(
              extractHostRequestErrorMessage(error, 'The reservation could not be updated.'),
            );
          }
        }}
        onRunReservationAction={async (reservationId, action) => {
          await handleReservationAction(reservationId, action);
        }}
        onOpenReservation={
          selectedReservation
            ? () =>
                router.push({
                  pathname: '/reservation-modal/[id]',
                  params: { id: selectedReservation.id, date: selectedDate },
                })
            : undefined
        }
      />

      <AddPartyModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={async (data) => {
          // Optimistic onMutate already shows the party; close instantly and
          // reconcile in the background.
          fireHostMutation(
            createWaitlistEntry({
              guestName: data.name,
              guestPhone: data.phone,
              partySize: data.size,
              seatingPreference: data.seatingPreference,
              quotedWaitMinutes: data.quotedWaitMinutes,
              notes: data.notes,
              source: 'manual',
            }),
            'Unable to Add Party',
            'The party could not be added to the waitlist.',
          );
        }}
      />
      <WaitlistNotifySheet
        visible={Boolean(notifyEntryId)}
        resetKey={notifyEntryId}
        templates={templatesQuery.data ?? []}
        partyName={
          waitlistEntries.find((entry) => entry.id === notifyEntryId)?.guest.name ?? 'Guest'
        }
        partySize={waitlistEntries.find((entry) => entry.id === notifyEntryId)?.partySize ?? 2}
        isSending={waitlistNotify.isPending}
        onClose={() => setNotifyEntryId(null)}
        onSend={async (input) => {
          if (!notifyEntryId) {
            return;
          }

          try {
            await waitlistNotify.mutateAsync({ entryId: notifyEntryId, input });
            setNotifyEntryId(null);
          } catch (error) {
            Alert.alert(
              'Unable to Notify',
              extractHostRequestErrorMessage(error, 'The guest could not be notified.'),
            );
          }
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
    paddingHorizontal: spacing.xl,
    paddingTop: 28,
    paddingBottom: spacing.md,
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
  segmentText: {
    ...textStyles.captionMedium,
    fontWeight: '800',
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
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueWorkspace: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  queuePanel: {
    width: 284,
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  queueBoard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  panelEyebrow: {
    ...textStyles.sectionLabel,
    marginBottom: spacing.md,
  },
  queueSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  queueSwitchIcon: {
    width: 34,
    alignItems: 'center',
  },
  queueSwitchText: {
    flex: 1,
  },
  switchSubtext: {
    ...textStyles.tiny,
    marginTop: 1,
  },
  dateButton: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateButtonText: {
    ...textStyles.captionMedium,
    fontWeight: '700',
  },
  searchBar: {
    marginTop: spacing.sm,
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
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
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
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    paddingVertical: spacing.md,
  },
  boardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  boardTitle: {
    ...textStyles.subtitle,
  },
  boardSubtitle: {
    ...textStyles.caption,
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
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
  retryButton: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    ...textStyles.captionMedium,
  },
});
