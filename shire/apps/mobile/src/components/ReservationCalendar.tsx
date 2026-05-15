import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import type { ReservationDensityDay } from '@shire/shared';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type ReservationCalendarProps = {
  month: Date;
  densityDays: ReservationDensityDay[];
  onChangeMonth: (month: Date) => void;
  onSelectDate: (date: string) => void;
};

export function ReservationCalendar({
  month,
  densityDays,
  onChangeMonth,
  onSelectDate,
}: ReservationCalendarProps) {
  const { colors } = useTheme();
  const densityByDate = useMemo(
    () => new Map(densityDays.map((day) => [day.date, day])),
    [densityDays],
  );
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onChangeMonth(subMonths(month, 1))}>
          <Text style={[styles.nav, { color: colors.text.primary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {format(month, 'MMMM yyyy')}
        </Text>
        <TouchableOpacity onPress={() => onChangeMonth(addMonths(month, 1))}>
          <Text style={[styles.nav, { color: colors.text.primary }]}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.week}>
        {DAYS.map((day) => (
          <Text key={day} style={[styles.dayLabel, { color: colors.text.muted }]}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((date) => {
          const key = format(date, 'yyyy-MM-dd');
          const day = densityByDate.get(key);
          const inMonth = isSameMonth(date, month);
          const count = day?.reservationCount ?? 0;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.cell,
                {
                  backgroundColor: day?.hasBlackout
                    ? colors.status.dirty.fill
                    : colors.surface.level1,
                  borderColor: isToday(date) ? colors.accent : colors.glass.borderSubtle,
                  opacity: inMonth ? 1 : 0.35,
                },
              ]}
              onPress={() => onSelectDate(key)}
            >
              <Text
                style={[
                  styles.dateText,
                  { color: isToday(date) ? colors.accent : colors.text.primary },
                ]}
              >
                {format(date, 'd')}
              </Text>
              <View style={styles.dotRow}>
                {Array.from({ length: Math.min(3, count) }).map((_, index) => (
                  <View key={index} style={[styles.dot, { backgroundColor: colors.accent }]} />
                ))}
              </View>
              {day?.hasBlackout && (
                <Text style={[styles.blackout, { color: colors.status.dirty.text }]}>Blocked</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...textStyles.subtitle },
  nav: { fontSize: 30, fontWeight: '700' },
  week: { flexDirection: 'row' },
  dayLabel: { ...textStyles.tiny, flex: 1, textAlign: 'center', textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  cell: {
    width: `${100 / 7 - 1}%`,
    minHeight: 72,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    alignItems: 'center',
  },
  dateText: { ...textStyles.captionMedium },
  dotRow: { flexDirection: 'row', gap: 3, minHeight: 8, marginTop: spacing.xs },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  blackout: { ...textStyles.tiny, marginTop: spacing.xs },
});
