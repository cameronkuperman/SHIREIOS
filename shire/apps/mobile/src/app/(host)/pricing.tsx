import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import {
  MIMOSAS_OPPORTUNITY_SUMMARY,
  MIMOSAS_PRICING_RECOMMENDATIONS,
  type MimosasPricingRecommendation,
  useMimosasScenarioStore,
} from '@/features/host/mimosasScenario';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

type Decision = 'accepted' | 'ignored';

const TONE_ICON: Record<MimosasPricingRecommendation['tone'], keyof typeof Ionicons.glyphMap> = {
  raise: 'trending-up-outline',
  lower: 'trending-down-outline',
  promote: 'megaphone-outline',
};

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

function RecommendationCard({
  recommendation,
  decision,
  onDecision,
}: {
  recommendation: MimosasPricingRecommendation;
  decision: Decision | null;
  onDecision: (decision: Decision) => void;
}) {
  const { colors } = useTheme();
  const traceRows = [
    { label: 'Demand signal', value: recommendation.reasoningTrace.demand },
    { label: 'Floor capacity', value: recommendation.reasoningTrace.floorCapacity },
    { label: 'Kitchen load', value: recommendation.reasoningTrace.kitchenLoad },
    { label: 'Margin impact', value: recommendation.reasoningTrace.marginImpact },
    { label: 'Guardrail', value: recommendation.reasoningTrace.guardrail },
  ];

  return (
    <View
      style={[
        styles.recommendationCard,
        { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
      ]}
    >
      <View style={styles.recommendationHeader}>
        <View style={styles.recommendationTitleRow}>
          <View style={[styles.iconBadge, { backgroundColor: colors.accentLight }]}>
            <Ionicons name={TONE_ICON[recommendation.tone]} size={18} color={colors.accent} />
          </View>
          <View style={styles.recommendationTitleBlock}>
            <Text style={[styles.itemName, { color: colors.text.primary }]}>
              {recommendation.item}
            </Text>
            <Text style={[styles.actionText, { color: colors.accent }]}>
              {recommendation.action}
            </Text>
          </View>
        </View>
        <View style={[styles.confidencePill, { backgroundColor: colors.surface.level4 }]}>
          <Text style={[styles.confidenceText, { color: colors.text.secondary }]}>
            {recommendation.confidence}% confidence
          </Text>
        </View>
      </View>

      <View style={styles.metricRow}>
        <View style={[styles.metricPill, { backgroundColor: colors.surface.level3 }]}>
          <Text style={[styles.metricValue, { color: colors.text.primary }]}>
            {formatCurrency(recommendation.weeklyLift)}
          </Text>
          <Text style={[styles.metricLabel, { color: colors.text.muted }]}>weekly lift</Text>
        </View>
        <View style={[styles.metricPill, { backgroundColor: colors.surface.level3 }]}>
          <Text style={[styles.metricValue, { color: colors.text.primary }]}>
            {recommendation.coversAffected}
          </Text>
          <Text style={[styles.metricLabel, { color: colors.text.muted }]}>covers affected</Text>
        </View>
      </View>

      <View style={[styles.traceBox, { borderColor: colors.border.subtle }]}>
        <Text style={[styles.traceTitle, { color: colors.text.primary }]}>Reasoning Trace</Text>
        {traceRows.map((row) => (
          <View key={row.label} style={styles.traceRow}>
            <Text style={[styles.traceLabel, { color: colors.text.secondary }]}>{row.label}</Text>
            <Text style={[styles.traceValue, { color: colors.text.muted }]}>{row.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          activeOpacity={0.76}
          accessibilityRole="button"
          style={[
            styles.primaryButton,
            {
              backgroundColor: decision === 'accepted' ? colors.status.available.text : '#242016',
            },
          ]}
          onPress={() => onDecision('accepted')}
        >
          <Ionicons name="checkmark-outline" size={15} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>
            {decision === 'accepted' ? 'Accepted' : 'Accept'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.76}
          accessibilityRole="button"
          style={[
            styles.secondaryButton,
            {
              backgroundColor: decision === 'ignored' ? colors.surface.level4 : colors.surface.level1,
              borderColor: colors.border.default,
            },
          ]}
          onPress={() => onDecision('ignored')}
        >
          <Ionicons name="close-outline" size={15} color={colors.text.secondary} />
          <Text style={[styles.secondaryButtonText, { color: colors.text.secondary }]}>
            {decision === 'ignored' ? 'Ignored' : 'Ignore'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HostPricingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const isMimosasScenarioActive = useMimosasScenarioStore((state) => state.isActive);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const acceptedLift = useMemo(
    () =>
      MIMOSAS_PRICING_RECOMMENDATIONS.reduce(
        (sum, recommendation) =>
          decisions[recommendation.id] === 'accepted'
            ? sum + recommendation.weeklyLift
            : sum,
        0,
      ),
    [decisions],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border.default }]}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.text.muted }]}>Menu</Text>
          <Text style={[styles.title, { color: colors.text.primary }]}>Revenue Guidance</Text>
          <Text style={[styles.subtitle, { color: colors.text.muted }]}>
            Broad menu moves from demand patterns, margin, and operating guardrails.
          </Text>
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
        {!isMimosasScenarioActive ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
            ]}
          >
            <Ionicons name="pricetag-outline" size={22} color={colors.text.secondary} />
            <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
              Load a live shift
            </Text>
            <Text style={[styles.emptyBody, { color: colors.text.muted }]}>
              Menu recommendations appear once a shift has floor, demand, and pacing signals.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryGrid}>
              {[
                {
                  label: 'Expected Weekly Lift',
                  value: formatCurrency(MIMOSAS_OPPORTUNITY_SUMMARY.expectedWeeklyLift),
                },
                {
                  label: 'Accepted Lift',
                  value: formatCurrency(acceptedLift),
                },
                {
                  label: 'Covers Affected',
                  value: String(
                    MIMOSAS_PRICING_RECOMMENDATIONS.reduce(
                      (sum, recommendation) => sum + recommendation.coversAffected,
                      0,
                    ),
                  ),
                },
                {
                  label: 'Review Queue',
                  value: String(MIMOSAS_PRICING_RECOMMENDATIONS.length),
                },
              ].map((stat) => (
                <View
                  key={stat.label}
                  style={[
                    styles.summaryCard,
                    { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
                  ]}
                >
                  <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
                    {stat.value}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.recommendationList}>
              {MIMOSAS_PRICING_RECOMMENDATIONS.map((recommendation) => (
                <RecommendationCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  decision={decisions[recommendation.id] ?? null}
                  onDecision={(decision) =>
                    setDecisions((current) => ({ ...current, [recommendation.id]: decision }))
                  }
                />
              ))}
            </View>
          </>
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
  emptyCard: {
    minHeight: 168,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emptyTitle: {
    ...textStyles.label,
    fontWeight: '800',
  },
  emptyBody: {
    ...textStyles.caption,
    textAlign: 'center',
    maxWidth: 420,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    minHeight: 92,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    justifyContent: 'center',
  },
  summaryValue: {
    ...textStyles.subtitle,
    letterSpacing: 0,
  },
  summaryLabel: {
    ...textStyles.caption,
    marginTop: spacing.xs,
    fontWeight: '700',
  },
  recommendationList: {
    gap: spacing.md,
  },
  recommendationCard: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
    gap: spacing.md,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  recommendationTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    ...textStyles.label,
    fontWeight: '900',
  },
  actionText: {
    ...textStyles.captionMedium,
    marginTop: 3,
    fontWeight: '900',
  },
  confidencePill: {
    minHeight: 30,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  confidenceText: {
    ...textStyles.tiny,
    fontWeight: '900',
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricPill: {
    minHeight: 58,
    minWidth: 148,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  metricValue: {
    ...textStyles.label,
    fontWeight: '900',
  },
  metricLabel: {
    ...textStyles.tiny,
    marginTop: 2,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  traceBox: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  traceTitle: {
    ...textStyles.captionMedium,
    fontWeight: '900',
  },
  traceRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  traceLabel: {
    width: 120,
    ...textStyles.captionMedium,
    fontWeight: '800',
  },
  traceValue: {
    flex: 1,
    ...textStyles.caption,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  primaryButton: {
    height: 36,
    minWidth: 108,
    borderRadius: borderRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: {
    ...textStyles.captionMedium,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  secondaryButton: {
    height: 36,
    minWidth: 96,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    ...textStyles.captionMedium,
    fontWeight: '900',
  },
});
