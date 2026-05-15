import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { ConversationListItem } from '@/components/ConversationListItem';
import { InboxFilters, type InboxFilter } from '@/components/InboxFilters';
import { extractHostRequestErrorMessage } from '@/features/host/errors';
import { useConversations } from '@/features/messaging/hooks';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

export default function InboxScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [search, setSearch] = useState('');
  const query = useConversations({
    search,
    includeArchived: filter === 'archived',
  });
  const conversations = useMemo(() => {
    const list = query.data ?? [];
    switch (filter) {
      case 'unread':
        return list.filter((conversation) => conversation.unreadCount > 0);
      case 'waitlist':
        return list.filter((conversation) => conversation.activeWaitlistId != null);
      case 'reservations':
        return list.filter((conversation) => conversation.activeReservationId != null);
      case 'archived':
        return list.filter((conversation) => conversation.archivedAt != null);
      default:
        return list;
    }
  }, [filter, query.data]);
  const errorMessage = query.error
    ? extractHostRequestErrorMessage(query.error, 'Messages could not be loaded.')
    : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text.primary }]}>Inbox</Text>
          <Text style={[styles.subtitle, { color: colors.text.muted }]}>Guest SMS threads</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.iconButton,
              { backgroundColor: colors.surface.level2, borderColor: colors.glass.border },
            ]}
            onPress={() => router.push('/settings' as Href)}
          >
            <Ionicons name="settings-outline" size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.newButton, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/(host)/inbox/new' as Href)}
          >
            <Ionicons name="create-outline" size={18} color={colors.white} />
            <Text style={styles.newButtonText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.controls}>
        <View
          style={[
            styles.search,
            { backgroundColor: colors.surface.level1, borderColor: colors.glass.border },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.text.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search messages"
            placeholderTextColor={colors.text.muted}
          />
        </View>
        <InboxFilters value={filter} onChange={setFilter} />
      </View>
      {errorMessage && (
        <View style={[styles.banner, { backgroundColor: colors.status.dirty.fill }]}>
          <Text style={[styles.bannerText, { color: colors.status.dirty.text }]}>
            {errorMessage}
          </Text>
          <TouchableOpacity onPress={() => void query.refetch()}>
            <Text style={[styles.bannerAction, { color: colors.status.dirty.text }]}>
              Try again
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.list}>
        {query.isLoading && conversations.length === 0 && (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.emptyText, { color: colors.text.muted }]}>Loading messages</Text>
          </View>
        )}
        {!query.isLoading && conversations.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="chatbubble-ellipses-outline" size={42} color={colors.text.muted} />
            <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No messages yet</Text>
            <Text style={[styles.emptyText, { color: colors.text.muted }]}>
              Start a conversation
            </Text>
          </View>
        )}
        {conversations.map((conversation) => (
          <ConversationListItem
            key={conversation.id}
            conversation={conversation}
            onPress={() => router.push(`/(host)/inbox/${conversation.id}` as Href)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  title: { ...textStyles.title },
  subtitle: { ...textStyles.caption, marginTop: spacing.xs },
  headerActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  newButtonText: { ...textStyles.captionMedium, color: '#FFFFFF' },
  controls: { paddingHorizontal: spacing.xl },
  search: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: { flex: 1, ...textStyles.body },
  banner: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
  },
  bannerText: { ...textStyles.caption, flex: 1 },
  bannerAction: { ...textStyles.captionMedium },
  list: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  empty: { alignItems: 'center', paddingVertical: spacing['3xl'], gap: spacing.sm },
  emptyTitle: { ...textStyles.subtitle },
  emptyText: { ...textStyles.body },
});
