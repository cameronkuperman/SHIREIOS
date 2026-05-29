import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useHostShiftAnalytics } from '@/features/host/hooks';
import type { HostAnalyticsRange, HostShiftAnalyticsResponse } from '@/features/host/api';
import { WAITER_COLORS, useWaiterColorMap } from '@/features/routing';
import { borderRadius, fontFamily, spacing, textStyles, useTheme } from '@/theme';

type HourlyShiftMetric = HostShiftAnalyticsResponse['hourly'][number];
type WaiterMetric = HostShiftAnalyticsResponse['waiters'][number];
type ShiftInsight = HostShiftAnalyticsResponse['insights'][number];
type LongOccupiedTable = HostShiftAnalyticsResponse['bottlenecks']['longOccupiedTables'][number];

const RANGE_TABS: { key: HostAnalyticsRange; label: string }[] = [
  { key: 'current_shift', label: 'Current Shift' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
];

const RANGE_LABEL: Record<HostAnalyticsRange, string> = {
  current_shift: 'Current Shift',
  today: 'Today',
  week: 'Week',
};

const SIGNAL_LABEL: Record<WaiterMetric['signal'], string> = {
  load_watch: 'Load watch',
  fastest_flow: 'Fastest flow',
  needs_support: 'Needs support',
  steady: 'Steady',
};

function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return '--';
  return `${minutes}m`;
}

function KPIGrid({ analytics }: { analytics: HostShiftAnalyticsResponse }) {
  const { colors } = useTheme();
  const cards = [
    {
      label: 'Covers',
      value: String(analytics.summary.covers),
      note: RANGE_LABEL[analytics.range],
    },
    { label: 'Parties', value: String(analytics.summary.parties), note: 'seated' },
    {
      label: 'Tables Turned',
      value: String(analytics.summary.tablesTurned),
      note: 'complete',
    },
    {
      label: 'Avg Turn Time',
      value: formatMinutes(analytics.summary.avgTurnTimeMinutes),
      note: 'occ -> dirty',
    },
    {
      label: 'Peak Hour',
      value: analytics.summary.peakBucketLabel ?? '--',
      note: analytics.summary.peakBucketLabel ? 'highest covers' : 'no covers yet',
    },
  ];

  return (
    <View style={styles.kpiGrid}>
      {cards.map((card) => (
        <View
          key={card.label}
          style={[
            styles.kpiCard,
            { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
          ]}
        >
          <Text style={[styles.kpiLabel, { color: colors.text.muted }]}>{card.label}</Text>
          <Text style={[styles.kpiValue, { color: colors.text.primary }]}>{card.value}</Text>
          <Text style={[styles.kpiNote, { color: colors.text.muted }]}>{card.note}</Text>
        </View>
      ))}
    </View>
  );
}

function HourlyTimeline({ rows }: { rows: HourlyShiftMetric[] }) {
  const { colors } = useTheme();
  const maxCovers = Math.max(1, ...rows.map((row) => row.covers));
  const nowMs = Date.now();
  const peakActualCovers = Math.max(
    0,
    ...rows
      .filter((row) => new Date(row.bucketStart).getTime() <= nowMs)
      .map((row) => row.covers),
  );

  if (rows.length === 0) {
    return <EmptyStateText label="No hourly activity yet." />;
  }

  return (
    <View style={styles.timeline}>
      {rows.map((row) => {
        const isForecast = new Date(row.bucketStart).getTime() > nowMs;
        const activeParties = Math.max(0, row.parties - row.tablesTurned);
        return (
          <View
            key={`${row.bucketStart}-${row.bucketLabel}`}
            style={[styles.timelineRow, isForecast ? { opacity: 0.76 } : null]}
          >
            <View style={styles.timelineTimeBlock}>
              <Text style={[styles.timelineTime, { color: colors.text.secondary }]}>
                {row.bucketLabel}
              </Text>
              {isForecast ? (
                <Text style={[styles.timelinePeak, { color: colors.text.muted }]}>PLAN</Text>
              ) : row.covers === peakActualCovers ? (
                <Text style={[styles.timelinePeak, { color: colors.accent }]}>PEAK</Text>
              ) : null}
            </View>
            <View style={styles.timelineBody}>
              <View style={[styles.timelineTrack, { backgroundColor: colors.surface.level4 }]}>
                <View
                  style={[
                    styles.timelineBar,
                    {
                      width:
                        row.covers === 0
                          ? '0%'
                          : `${Math.max(10, (row.covers / maxCovers) * 100)}%`,
                      backgroundColor:
                        !isForecast && row.covers === peakActualCovers
                          ? colors.accent
                          : colors.status.occupied.text,
                    },
                  ]}
                />
              </View>
              <View style={styles.timelineMeta}>
                <Text style={[styles.timelinePrimary, { color: colors.text.primary }]}>
                  {row.covers} covers{isForecast ? ' forecast' : ''}
                </Text>
                <Text style={[styles.timelineSecondary, { color: colors.text.muted }]}>
                  {row.parties} seated · {row.tablesTurned} completed · {activeParties} active
                  {row.avgTurnTimeMinutes != null
                    ? ` · ${formatMinutes(row.avgTurnTimeMinutes)} avg`
                    : ''}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function WaiterLoadTable({
  waiters,
  waiterColorMap,
}: {
  waiters: WaiterMetric[];
  waiterColorMap: Record<string, string>;
}) {
  const { colors } = useTheme();
  const maxCovers = Math.max(1, ...waiters.map((waiter) => waiter.covers));

  if (waiters.length === 0) {
    return <EmptyStateText label="No waiter activity yet." />;
  }

  return (
    <View style={styles.waiterList}>
      {waiters.map((waiter, index) => {
        const waiterColor =
          waiterColorMap[waiter.waiterId] ?? WAITER_COLORS[index % WAITER_COLORS.length]!;
        return (
          <View key={waiter.waiterId} style={styles.waiterRow}>
            <View style={styles.waiterIdentity}>
              <View style={[styles.waiterDot, { backgroundColor: waiterColor }]} />
              <View style={styles.waiterNameBlock}>
                <Text style={[styles.waiterName, { color: colors.text.primary }]}>
                  {waiter.waiterName}
                </Text>
                <Text style={[styles.waiterSignal, { color: colors.text.muted }]}>
                  {SIGNAL_LABEL[waiter.signal]}
                </Text>
              </View>
            </View>
            <View style={styles.waiterLoad}>
              <View style={[styles.waiterTrack, { backgroundColor: colors.surface.level4 }]}>
                <View
                  style={[
                    styles.waiterBar,
                    {
                      width:
                        waiter.covers === 0
                          ? '0%'
                          : `${Math.max(8, (waiter.covers / maxCovers) * 100)}%`,
                      backgroundColor: waiterColor,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.waiterMeta, { color: colors.text.secondary }]}>
                {waiter.covers} covers · {waiter.tablesServed} tables · {waiter.liveTables} live ·{' '}
                {formatMinutes(waiter.avgTurnTimeMinutes)} avg
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function InsightGrid({ insights }: { insights: ShiftInsight[] }) {
  const { colors } = useTheme();

  if (insights.length === 0) {
    return <EmptyStateText label="No insights yet." />;
  }

  return (
    <View style={styles.insightGrid}>
      {insights.map((insight) => {
        const icon =
          insight.tone === 'good'
            ? 'checkmark-circle-outline'
            : insight.tone === 'watch'
              ? 'pulse-outline'
              : 'information-circle-outline';
        const toneColor =
          insight.tone === 'good'
            ? colors.status.available.text
            : insight.tone === 'watch'
              ? colors.needsServer.text
              : colors.status.occupied.text;
        return (
          <View
            key={insight.title}
            style={[
              styles.insightCard,
              { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
            ]}
          >
            <Ionicons name={icon} size={18} color={toneColor} />
            <View style={styles.insightText}>
              <Text style={[styles.insightTitle, { color: colors.text.primary }]}>
                {insight.title}
              </Text>
              <Text style={[styles.insightBody, { color: colors.text.muted }]}>
                {insight.detail}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function LongOccupiedList({ rows }: { rows: LongOccupiedTable[] }) {
  const { colors } = useTheme();

  if (rows.length === 0) {
    return <EmptyStateText label="No long-occupied tables." />;
  }

  return (
    <View style={styles.bottleneckList}>
      {rows.map((row) => (
        <View key={row.tableId} style={styles.bottleneckRow}>
          <View style={[styles.tableBadge, { backgroundColor: colors.surface.level4 }]}>
            <Text style={[styles.tableBadgeText, { color: colors.text.primary }]}>
              T{row.tableLabel}
            </Text>
          </View>
          <Text style={[styles.bottleneckText, { color: colors.text.secondary }]}>
            {row.waiterName ?? 'Unassigned'} · occupied {formatMinutes(row.occupiedMinutes)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function EmptyStateText({ label }: { label: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.emptyStateText, { color: colors.text.muted }]}>{label}</Text>;
}

function AnalyticsStateCard({
  title,
  body,
  icon,
  isLoading,
  onRetry,
}: {
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  isLoading?: boolean;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.stateCard,
        { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.text.secondary} />
      ) : (
        <Ionicons name={icon} size={22} color={colors.text.secondary} />
      )}
      <View style={styles.stateCopy}>
        <Text style={[styles.stateTitle, { color: colors.text.primary }]}>{title}</Text>
        <Text style={[styles.stateBody, { color: colors.text.muted }]}>{body}</Text>
      </View>
      {onRetry ? (
        <TouchableOpacity
          activeOpacity={0.76}
          style={[styles.retryButton, { backgroundColor: colors.surface.level4 }]}
          onPress={onRetry}
        >
          <Text style={[styles.retryButtonText, { color: colors.text.secondary }]}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Section({
  title,
  note,
  children,
  style,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
        style,
      ]}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{title}</Text>
        {note ? (
          <Text style={[styles.sectionNote, { color: colors.text.muted }]}>{note}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export default function HostAnalyticsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const waiterColorMap = useWaiterColorMap();
  const [activeRange, setActiveRange] = useState<HostAnalyticsRange>('current_shift');
  const analyticsQuery = useHostShiftAnalytics(activeRange);
  const analytics = analyticsQuery.data;
  const subtitle = useMemo(() => {
    if (analyticsQuery.isLoading && !analytics) return 'Loading live shift analytics.';
    if (analyticsQuery.isError) return 'Unable to load live analytics.';
    return `${RANGE_LABEL[activeRange]} from host shift activity.`;
  }, [activeRange, analytics, analyticsQuery.isError, analyticsQuery.isLoading]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border.default }]}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.text.muted }]}>Analytics</Text>
          <Text style={[styles.title, { color: colors.text.primary }]}>Shift Flow</Text>
          <Text style={[styles.subtitle, { color: colors.text.muted }]}>{subtitle}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.76}
          accessibilityRole="button"
          accessibilityLabel="Back to floor"
          style={[styles.iconButton, { backgroundColor: colors.surface.level1 }]}
          onPress={() => router.push('/(host)' as Href)}
        >
          <Ionicons name="grid-outline" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.tabs, { backgroundColor: colors.surface.level4 }]}>
          {RANGE_TABS.map((tab) => {
            const active = tab.key === activeRange;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.76}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.tab, active ? { backgroundColor: colors.surface.level1 } : null]}
                onPress={() => setActiveRange(tab.key)}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: active ? colors.text.primary : colors.text.muted },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {analyticsQuery.isLoading && !analytics ? (
          <AnalyticsStateCard
            title="Loading analytics"
            body="Pulling the latest host shift activity."
            icon="analytics-outline"
            isLoading
          />
        ) : analyticsQuery.isError ? (
          <AnalyticsStateCard
            title="Analytics unavailable"
            body="The live analytics endpoint could not be reached."
            icon="warning-outline"
            onRetry={() => void analyticsQuery.refetch()}
          />
        ) : analytics ? (
          <>
            <KPIGrid analytics={analytics} />
            <InsightGrid insights={analytics.insights} />

            <View style={styles.mainDashboardGrid}>
              <Section
                title="Hourly Timeline"
                note="Covers, completed turns, avg turn time"
                style={styles.timelineSection}
              >
                <HourlyTimeline rows={analytics.hourly} />
              </Section>

              <View style={styles.sideColumn}>
                <Section title="Waiter Load" note="Operational view, not rankings">
                  <WaiterLoadTable waiters={analytics.waiters} waiterColorMap={waiterColorMap} />
                </Section>

                <Section title="Long Occupied" note="Watch list">
                  <LongOccupiedList rows={analytics.bottlenecks.longOccupiedTables} />
                </Section>
              </View>
            </View>
          </>
        ) : (
          <AnalyticsStateCard
            title="No analytics yet"
            body="No shift activity has been recorded for this range."
            icon="bar-chart-outline"
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  eyebrow: {
    ...textStyles.sectionLabel,
  },
  title: {
    ...textStyles.subtitle,
    letterSpacing: 0,
    marginTop: 3,
  },
  subtitle: {
    ...textStyles.caption,
    marginTop: spacing.xs,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  tabs: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    borderRadius: borderRadius.sm,
    padding: 3,
    gap: 3,
  },
  tab: {
    height: 34,
    minWidth: 116,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  tabText: {
    ...textStyles.captionMedium,
    fontWeight: '800',
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kpiCard: {
    flex: 1,
    minHeight: 94,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
  },
  kpiLabel: {
    ...textStyles.sectionLabel,
  },
  kpiValue: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 25,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.sm,
  },
  kpiNote: {
    ...textStyles.tiny,
    marginTop: spacing.xs,
  },
  insightGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  emptyStateText: {
    ...textStyles.caption,
    lineHeight: 18,
  },
  stateCard: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
  },
  stateCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  stateTitle: {
    ...textStyles.captionMedium,
    fontWeight: '800',
  },
  stateBody: {
    ...textStyles.caption,
    lineHeight: 18,
  },
  retryButton: {
    minHeight: 34,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  retryButtonText: {
    ...textStyles.captionMedium,
    fontWeight: '800',
  },
  insightCard: {
    flex: 1,
    minHeight: 92,
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
  },
  insightText: {
    flex: 1,
  },
  insightTitle: {
    ...textStyles.captionMedium,
    fontWeight: '800',
  },
  insightBody: {
    ...textStyles.caption,
    marginTop: 3,
    lineHeight: 18,
  },
  mainDashboardGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  section: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
  },
  timelineSection: {
    flex: 1,
  },
  sectionHeader: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...textStyles.label,
    fontWeight: '800',
  },
  sectionNote: {
    ...textStyles.caption,
    marginTop: 3,
  },
  timeline: {
    gap: spacing.md,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  timelineTimeBlock: {
    width: 54,
    gap: 2,
  },
  timelineTime: {
    ...textStyles.captionMedium,
  },
  timelinePeak: {
    ...textStyles.tiny,
    fontWeight: '900',
  },
  timelineBody: {
    flex: 1,
    gap: spacing.xs,
  },
  timelineTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  timelineBar: {
    height: '100%',
    borderRadius: 6,
  },
  timelineMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  timelinePrimary: {
    ...textStyles.captionMedium,
    fontVariant: ['tabular-nums'],
  },
  timelineSecondary: {
    ...textStyles.caption,
    fontVariant: ['tabular-nums'],
  },
  sideColumn: {
    width: 420,
    gap: spacing.lg,
  },
  waiterList: {
    gap: spacing.md,
  },
  waiterRow: {
    gap: spacing.sm,
  },
  waiterIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  waiterDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  waiterNameBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  waiterName: {
    ...textStyles.captionMedium,
    fontWeight: '800',
  },
  waiterSignal: {
    ...textStyles.tiny,
  },
  waiterLoad: {
    gap: spacing.xs,
  },
  waiterTrack: {
    height: 9,
    borderRadius: 5,
    overflow: 'hidden',
  },
  waiterBar: {
    height: '100%',
    borderRadius: 5,
  },
  waiterMeta: {
    ...textStyles.tiny,
    fontVariant: ['tabular-nums'],
  },
  bottleneckList: {
    gap: spacing.sm,
  },
  bottleneckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tableBadge: {
    minWidth: 42,
    height: 30,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  tableBadgeText: {
    ...textStyles.tiny,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  bottleneckText: {
    flex: 1,
    ...textStyles.caption,
  },
});
