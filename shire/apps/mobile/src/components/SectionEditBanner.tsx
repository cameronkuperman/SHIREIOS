import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { textStyles, spacing, borderRadius } from '@/theme';
import { useTheme } from '@/theme';
import { GlassSurface } from '@/components/GlassSurface';

type SectionEditBannerProps = {
  serverName: string;
  serverColor: string;
};

export function SectionEditBanner({ serverName, serverColor }: SectionEditBannerProps) {
  const { colors } = useTheme();

  return (
    <GlassSurface intensity={40} borderRadius={borderRadius.lg} style={styles.banner}>
      <View style={[styles.dot, { backgroundColor: serverColor }]} />
      <Text style={[styles.text, { color: colors.text.secondary }]}>
        Editing Sections — Tap tables to assign to{' '}
        <Text style={{ color: serverColor, fontWeight: '700' }}>{serverName}</Text>
      </Text>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  text: {
    ...textStyles.caption,
    flex: 1,
  },
});
