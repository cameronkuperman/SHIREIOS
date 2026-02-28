import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { textStyles, spacing, borderRadius, useTheme } from '@/theme';
import { WaitlistCard, type WaitlistParty } from '@/components/WaitlistCard';

const waitlistData: WaitlistParty[] = [
  { name: 'Sarah S.', size: 4, wait: '15m', status: 'Waiting' },
  { name: 'David M.', size: 6, wait: '20m', status: 'Waiting' },
  { name: 'Emily L.', size: 2, wait: 'Now', status: 'Next' },
  { name: 'John K.', size: 5, wait: '30m', status: 'Waiting' },
  { name: 'Anna P.', size: 8, wait: '45m', status: 'Waiting' },
  { name: 'Chris T.', size: 2, wait: '1h', status: 'Waiting' },
  { name: 'Lisa W.', size: 3, wait: '1h 15m', status: 'Waiting' },
  { name: 'Mark R.', size: 4, wait: '1h 30m', status: 'Waiting' },
];

export default function WaitlistScreen() {
  const { colors } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>Waitlist</Text>
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
              {waitlistData.length} parties
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.accent }]}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {waitlistData.map((party, index) => (
          <Animated.View key={index} entering={FadeIn.delay(index * 50).duration(300)}>
            <WaitlistCard
              party={party}
              index={index}
              isSelected={selectedIndex === index}
              onPress={() => setSelectedIndex(selectedIndex === index ? null : index)}
            />
          </Animated.View>
        ))}
      </ScrollView>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
});
