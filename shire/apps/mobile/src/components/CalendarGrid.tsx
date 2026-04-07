import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';
import { textStyles, spacing, borderRadius } from '@/theme';
import { useTheme } from '@/theme';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type CalendarGridProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  currentMonth: Date;
  onChangeMonth: (date: Date) => void;
  datesWithBookings?: Set<string>; // YYYY-MM-DD strings
};

export function CalendarGrid({
  selectedDate,
  onSelectDate,
  currentMonth,
  onChangeMonth,
  datesWithBookings,
}: CalendarGridProps) {
  const { colors } = useTheme();

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  return (
    <View style={styles.container}>
      {/* Month header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onChangeMonth(subMonths(currentMonth, 1))}>
          <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: colors.text.primary }]}>
          {format(currentMonth, 'MMMM yyyy')}
        </Text>
        <TouchableOpacity onPress={() => onChangeMonth(addMonths(currentMonth, 1))}>
          <Ionicons name="chevron-forward" size={22} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Day of week headers */}
      <View style={styles.dayLabels}>
        {DAY_LABELS.map((label) => (
          <View key={label} style={styles.dayCell}>
            <Text style={[styles.dayLabel, { color: colors.text.muted }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {weeks.map((week, weekIdx) => (
        <View key={weekIdx} style={styles.weekRow}>
          {week.map((day) => {
            const inMonth = isSameMonth(day, currentMonth);
            const selected = isSameDay(day, selectedDate);
            const today = isToday(day);
            const dateKey = format(day, 'yyyy-MM-dd');
            const hasBooking = datesWithBookings?.has(dateKey);

            return (
              <TouchableOpacity
                key={dateKey}
                style={[
                  styles.dayCell,
                  selected && { backgroundColor: colors.accent, borderRadius: borderRadius.md },
                ]}
                onPress={() => inMonth && onSelectDate(day)}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: inMonth ? colors.text.primary : colors.text.muted },
                    today && !selected && { color: colors.accent, fontWeight: '700' },
                    selected && { color: colors.white, fontWeight: '700' },
                  ]}
                >
                  {format(day, 'd')}
                </Text>
                {hasBooking && !selected && (
                  <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                )}
                {hasBooking && selected && (
                  <View style={[styles.dot, { backgroundColor: colors.white }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.lg,
  },
  monthTitle: {
    ...textStyles.subtitle,
  },
  dayLabels: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  dayLabel: {
    ...textStyles.tiny,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dayText: {
    ...textStyles.caption,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
});
