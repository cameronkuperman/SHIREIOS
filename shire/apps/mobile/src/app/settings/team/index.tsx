import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { useAuth } from '@/features/auth';
import { useWaiters } from '@/features/routing';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

export default function TeamSettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentLocation } = useAuth();
  const { waiters, isLoading, error, addWaiter, isAdding, refetch } = useWaiters(currentLocation?.id);
  const [name, setName] = useState('');

  const handleAddWaiter = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name Required', 'Enter the waiter name before adding them to the roster.');
      return;
    }
    try {
      await addWaiter({ name: trimmedName, role: 'server' });
      setName('');
    } catch (createError) {
      Alert.alert(
        'Unable to Add Waiter',
        createError instanceof Error ? createError.message : 'The waiter could not be saved.',
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Team / Waiters</Text>
          <Text style={[styles.subtitle, { color: colors.text.muted }]}>
            {currentLocation?.name ?? 'No location selected'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            if (currentLocation?.id) {
              void refetch();
            }
          }}
        >
          <Ionicons name="refresh-outline" size={22} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.addPanel,
            { backgroundColor: colors.surface.level1, borderColor: colors.border.subtle },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text.muted }]}>ADD TO ROSTER</Text>
          <View style={styles.addRow}>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text.primary,
                  backgroundColor: colors.surface.level2,
                  borderColor: colors.border.subtle,
                },
              ]}
              placeholder="Waiter name"
              placeholderTextColor={colors.text.muted}
              value={name}
              onChangeText={setName}
              onSubmitEditing={handleAddWaiter}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[
                styles.addButton,
                { backgroundColor: isAdding ? colors.surface.level2 : colors.accent },
              ]}
              disabled={isAdding}
              onPress={handleAddWaiter}
            >
              {isAdding ? (
                <ActivityIndicator color={colors.text.muted} />
              ) : (
                <Ionicons name="add" size={22} color={colors.white} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={[styles.help, { color: colors.text.muted }]}>
            Exact duplicate names reuse the saved waiter instead of creating another record.
          </Text>
        </View>

        <View style={styles.listHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text.muted }]}>SAVED WAITERS</Text>
          <Text style={[styles.count, { color: colors.text.secondary }]}>{waiters.length}</Text>
        </View>
        {isLoading && <ActivityIndicator color={colors.accent} />}
        {error && <Text style={[styles.empty, { color: colors.status.dirty.text }]}>{error}</Text>}
        {!isLoading && !error && waiters.length === 0 && (
          <Text style={[styles.empty, { color: colors.text.muted }]}>
            No waiters saved yet. Add the roster here, then activate them in Shift Setup.
          </Text>
        )}
        {waiters.map((waiter) => (
          <View
            key={waiter.id}
            style={[
              styles.waiterRow,
              { backgroundColor: colors.surface.level1, borderColor: colors.border.subtle },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
              <Text style={[styles.avatarText, { color: colors.accent }]}>
                {waiter.name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.waiterText}>
              <Text style={[styles.waiterName, { color: colors.text.primary }]}>{waiter.name}</Text>
              <Text style={[styles.waiterMeta, { color: colors.text.muted }]}>
                {waiter.role ?? 'server'}
              </Text>
            </View>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.text.muted} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerText: { alignItems: 'center', flex: 1 },
  title: { ...textStyles.subtitle },
  subtitle: { ...textStyles.caption, marginTop: 2 },
  content: { padding: spacing.xl, gap: spacing.md },
  addPanel: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: { ...textStyles.tiny, fontWeight: '700' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...textStyles.body,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  help: { ...textStyles.caption },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  count: { ...textStyles.captionMedium },
  waiterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...textStyles.label },
  waiterText: { flex: 1 },
  waiterName: { ...textStyles.label },
  waiterMeta: { ...textStyles.caption, marginTop: 2, textTransform: 'capitalize' },
  empty: { ...textStyles.body, textAlign: 'center', paddingVertical: spacing.xl },
});
