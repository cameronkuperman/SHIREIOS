import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { supabase } from '@/services/supabase/client';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

const ROWS: {
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
}[] = [
  {
    label: 'Blackouts',
    sub: 'Block dates and service windows',
    icon: 'calendar-clear-outline',
    href: '/settings/blackouts',
  },
  {
    label: 'Message Templates',
    sub: 'Manage SMS templates',
    icon: 'chatbubble-ellipses-outline',
    href: '/settings/templates',
  },
  {
    label: 'Reservation Settings',
    sub: 'Read current booking policy',
    icon: 'settings-outline',
    href: '/settings/reservation-settings',
  },
  {
    label: 'Floor Builder',
    sub: 'Edit the host floor map',
    icon: 'map-outline',
    href: '/floor-builder',
  },
];

export default function SettingsHomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>Settings</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {ROWS.map((row) => (
          <TouchableOpacity
            key={row.label}
            style={[
              styles.row,
              { backgroundColor: colors.surface.level1, borderColor: colors.glass.border },
            ]}
            onPress={() => router.push(row.href as Href)}
          >
            <View style={[styles.rowIcon, { backgroundColor: colors.surface.level2 }]}>
              <Ionicons name={row.icon} size={20} color={colors.text.secondary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: colors.text.primary }]}>{row.label}</Text>
              <Text style={[styles.rowSub, { color: colors.text.muted }]}>{row.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[
            styles.row,
            { backgroundColor: colors.status.dirty.fill, borderColor: colors.status.dirty.border },
          ]}
          onPress={() => {
            void supabase.auth.signOut();
            router.replace('/(auth)' as Href);
          }}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.surface.level2 }]}>
            <Ionicons name="log-out-outline" size={20} color={colors.status.dirty.text} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: colors.status.dirty.text }]}>Sign Out</Text>
            <Text style={[styles.rowSub, { color: colors.status.dirty.text }]}>
              Return to the host login
            </Text>
          </View>
        </TouchableOpacity>
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...textStyles.title,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    ...textStyles.label,
  },
  rowSub: {
    ...textStyles.caption,
    marginTop: spacing.xs,
  },
});
