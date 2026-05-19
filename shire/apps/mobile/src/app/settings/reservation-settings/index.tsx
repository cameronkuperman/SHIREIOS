import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TimeWheelField } from '@/components/TimeWheelField';
import { useReservationSettings, useUpdateReservationSchedule } from '@/features/host/hooks';
import {
  createScheduleWindowDraft,
  describeClosedDays,
  scheduleWindowsToServicePeriods,
  servicePeriodsToScheduleWindows,
  WEEKDAYS,
  type ScheduleWindowDraft,
} from '@/features/host/reservationSchedule';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

function toMinutes(value: string): number {
  const [hour = '0', minute = '0'] = value.split(':');
  return Number(hour) * 60 + Number(minute);
}

function toNumber(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dayLabel(days: number[]): string {
  if (days.length === 0) return 'No days selected';
  return WEEKDAYS.filter((day) => days.includes(day.value))
    .map((day) => day.short)
    .join(', ');
}

export default function ReservationSettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const settings = useReservationSettings();
  const updateSchedule = useUpdateReservationSchedule();
  const [windows, setWindows] = useState<ScheduleWindowDraft[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!settings || hasInitialized) return;
    setWindows(servicePeriodsToScheduleWindows(settings.servicePeriods));
    setHasInitialized(true);
  }, [hasInitialized, settings]);

  const activeWindowCount = windows.filter((window) => window.active).length;
  const closedSummary = useMemo(() => describeClosedDays(windows), [windows]);

  const updateWindow = (draftId: string, patch: Partial<ScheduleWindowDraft>) => {
    setWindows((current) =>
      current.map((window) => (window.draftId === draftId ? { ...window, ...patch } : window)),
    );
    setIsDirty(true);
  };

  const toggleDay = (draftId: string, day: number) => {
    const target = windows.find((window) => window.draftId === draftId);
    if (!target) return;
    const days = target.days.includes(day)
      ? target.days.filter((current) => current !== day)
      : [...target.days, day];
    updateWindow(draftId, { days: days.sort((left, right) => left - right) });
  };

  const addWindow = () => {
    const next = createScheduleWindowDraft();
    setWindows((current) => [...current, next]);
    setExpandedId(next.draftId);
    setIsDirty(true);
  };

  const deactivateWindow = (draftId: string) => {
    updateWindow(draftId, { active: false, days: [] });
  };

  const validate = (): boolean => {
    for (const window of windows) {
      if (!window.active) continue;
      if (window.name.trim().length === 0) {
        Alert.alert('Missing Name', 'Name each booking window before saving.');
        return false;
      }
      if (window.days.length === 0) {
        Alert.alert('Missing Days', `${window.name} needs at least one selected day.`);
        return false;
      }
      if (toMinutes(window.startTime) >= toMinutes(window.endTime)) {
        Alert.alert('Invalid Time', `${window.name} must end after it starts.`);
        return false;
      }
      if (window.minPartySize > window.maxPartySize) {
        Alert.alert('Invalid Party Size', `${window.name} has a minimum larger than its maximum.`);
        return false;
      }
    }
    return true;
  };

  const save = () => {
    if (!validate()) return;
    const active = windows.filter((window) => window.active);
    const periodCount = scheduleWindowsToServicePeriods(active).length;
    Alert.alert(
      'Save Reservation Schedule?',
      `${active.length} booking window${active.length === 1 ? '' : 's'} will create ${periodCount} weekly service period${periodCount === 1 ? '' : 's'}.\n\nExisting reservations will not be changed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: () => {
            void (async () => {
              try {
                const saved = await updateSchedule.mutateAsync({
                  servicePeriods: scheduleWindowsToServicePeriods(active),
                });
                setWindows(servicePeriodsToScheduleWindows(saved.servicePeriods));
                setExpandedId(null);
                setIsDirty(false);
                Alert.alert('Schedule Saved', 'New bookings will use the updated schedule.');
              } catch (error) {
                Alert.alert('Unable to Save', 'Reservation schedule could not be saved.');
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Reservation Schedule</Text>
          <Text style={[styles.subtitle, { color: colors.text.muted }]}>
            Controls when new bookings can be made
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.accent }]}
          disabled={!isDirty || updateSchedule.isPending}
          onPress={save}
        >
          <Text style={styles.saveText}>{updateSchedule.isPending ? 'Saving' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.summary,
            { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
          ]}
        >
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
              {activeWindowCount}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>booking windows</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
              {settings?.bookingHorizonDays ?? 30}d
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>booking horizon</Text>
          </View>
          <View style={styles.summaryItemWide}>
            <Text style={[styles.summaryValueSmall, { color: colors.text.primary }]}>
              {closedSummary}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>closed for reservations</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Weekly Windows</Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.accentLight }]}
            onPress={addWindow}
          >
            <Ionicons name="add" size={18} color={colors.accent} />
            <Text style={[styles.addText, { color: colors.accent }]}>Add</Text>
          </TouchableOpacity>
        </View>

        {windows.filter((window) => window.active).length === 0 ? (
          <View
            style={[
              styles.empty,
              { backgroundColor: colors.surface.level1, borderColor: colors.border.subtle },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
              Closed for reservations
            </Text>
            <Text style={[styles.emptyText, { color: colors.text.muted }]}>
              Add a booking window to allow new reservations on selected days.
            </Text>
          </View>
        ) : null}

        {windows
          .filter((window) => window.active)
          .map((window) => {
            const isExpanded = expandedId === window.draftId;
            return (
              <View
                key={window.draftId}
                style={[
                  styles.windowCard,
                  { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
                ]}
              >
                <View style={styles.windowTop}>
                  <TextInput
                    style={[
                      styles.nameInput,
                      { color: colors.text.primary, borderColor: colors.border.subtle },
                    ]}
                    value={window.name}
                    onChangeText={(value) => updateWindow(window.draftId, { name: value })}
                    placeholder="Dinner"
                    placeholderTextColor={colors.text.muted}
                  />
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => deactivateWindow(window.draftId)}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.status.dirty.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <Text style={[styles.fieldLabel, { color: colors.text.muted }]}>Start</Text>
                    <TimeWheelField
                      value={window.startTime}
                      onChange={(value) => updateWindow(window.draftId, { startTime: value })}
                      minuteInterval={15}
                    />
                  </View>
                  <View style={styles.timeField}>
                    <Text style={[styles.fieldLabel, { color: colors.text.muted }]}>End</Text>
                    <TimeWheelField
                      value={window.endTime}
                      onChange={(value) => updateWindow(window.draftId, { endTime: value })}
                      minuteInterval={15}
                    />
                  </View>
                </View>

                <View style={styles.dayGrid}>
                  {WEEKDAYS.map((day) => {
                    const selected = window.days.includes(day.value);
                    return (
                      <TouchableOpacity
                        key={day.value}
                        style={[
                          styles.dayPill,
                          {
                            backgroundColor: selected ? colors.accent : colors.surface.level2,
                            borderColor: selected ? colors.accent : colors.border.subtle,
                          },
                        ]}
                        onPress={() => toggleDay(window.draftId, day.value)}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            { color: selected ? '#FFFFFF' : colors.text.primary },
                          ]}
                        >
                          {day.short}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.detailToggle}
                  onPress={() => setExpandedId(isExpanded ? null : window.draftId)}
                >
                  <Text style={[styles.detailText, { color: colors.text.secondary }]}>
                    {isExpanded ? 'Hide details' : `Details - ${dayLabel(window.days)}`}
                  </Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.text.muted}
                  />
                </TouchableOpacity>

                {isExpanded ? (
                  <View style={styles.details}>
                    <NumberField
                      label="Lead time minutes"
                      value={window.leadTimeMinutes}
                      onChange={(value) => updateWindow(window.draftId, { leadTimeMinutes: value })}
                    />
                    <NumberField
                      label="Slot interval minutes"
                      value={window.slotIntervalMinutes}
                      onChange={(value) =>
                        updateWindow(window.draftId, { slotIntervalMinutes: value })
                      }
                    />
                    <NumberField
                      label="Minimum party"
                      value={window.minPartySize}
                      onChange={(value) => updateWindow(window.draftId, { minPartySize: value })}
                    />
                    <NumberField
                      label="Maximum party"
                      value={window.maxPartySize}
                      onChange={(value) => updateWindow(window.draftId, { maxPartySize: value })}
                    />
                    <NumberField
                      label="Duration minutes"
                      value={window.defaultDurationMinutes}
                      onChange={(value) =>
                        updateWindow(window.draftId, { defaultDurationMinutes: value })
                      }
                    />
                    <View style={styles.cutoffRow}>
                      <View style={styles.cutoffField}>
                        <Text style={[styles.fieldLabel, { color: colors.text.muted }]}>
                          Same-day cutoff
                        </Text>
                        <TimeWheelField
                          value={window.sameDayCutoffTime}
                          onChange={(value) =>
                            updateWindow(window.draftId, { sameDayCutoffTime: value })
                          }
                          minuteInterval={15}
                        />
                      </View>
                      <TouchableOpacity
                        style={[styles.clearButton, { borderColor: colors.border.subtle }]}
                        onPress={() => updateWindow(window.draftId, { sameDayCutoffTime: null })}
                      >
                        <Text style={[styles.clearText, { color: colors.text.secondary }]}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.numberField}>
      <Text style={[styles.fieldLabel, { color: colors.text.muted }]}>{label}</Text>
      <TextInput
        style={[styles.numberInput, { color: colors.text.primary, borderColor: colors.border.subtle }]}
        value={String(value)}
        keyboardType="number-pad"
        onChangeText={(text) => onChange(toNumber(text, value))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...textStyles.subtitle },
  subtitle: { ...textStyles.caption },
  saveButton: {
    minWidth: 82,
    minHeight: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  saveText: { ...textStyles.label, color: '#FFFFFF' },
  content: { padding: spacing.xl, paddingBottom: spacing['3xl'], gap: spacing.lg },
  summary: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  summaryItem: { minWidth: 120, gap: spacing.xs },
  summaryItemWide: { flexGrow: 1, flexBasis: 220, gap: spacing.xs },
  summaryValue: { ...textStyles.title },
  summaryValueSmall: { ...textStyles.bodyMedium },
  summaryLabel: { ...textStyles.tiny, textTransform: 'uppercase' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { ...textStyles.subtitle },
  addButton: {
    minHeight: 40,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addText: { ...textStyles.label },
  empty: { borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.xl, gap: spacing.sm },
  emptyTitle: { ...textStyles.subtitle },
  emptyText: { ...textStyles.body },
  windowCard: { borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.lg, gap: spacing.md },
  windowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nameInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    ...textStyles.bodyMedium,
  },
  timeRow: { flexDirection: 'row', gap: spacing.md },
  timeField: { flex: 1, gap: spacing.xs },
  fieldLabel: { ...textStyles.captionMedium },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dayPill: {
    minWidth: 58,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  dayText: { ...textStyles.label },
  detailToggle: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailText: { ...textStyles.bodyMedium },
  details: { gap: spacing.md },
  numberField: { gap: spacing.xs },
  numberInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    ...textStyles.body,
  },
  cutoffRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  cutoffField: { flex: 1, gap: spacing.xs },
  clearButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { ...textStyles.label },
});
