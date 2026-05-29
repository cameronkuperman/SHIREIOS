import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type LayoutRectangle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HostSidebarParty } from '@/features/host/hooks';
import { borderRadius, fontFamily, spacing, textStyles, useTheme } from '@/theme';

const DROPDOWN_MAX_HEIGHT = 280;

type HostFloorSearchTable = {
  id: string;
  label: string;
};

type HostFloorSearchProps = {
  parties: HostSidebarParty[];
  tables: HostFloorSearchTable[];
  onSelectParty: (party: HostSidebarParty) => void;
  onSelectTable: (tableId: string) => void;
};

type SearchResult =
  | { kind: 'party'; party: HostSidebarParty }
  | { kind: 'table'; table: HostFloorSearchTable };

function matchesQuery(value: string, query: string): boolean {
  return value.toLowerCase().includes(query);
}

export function HostFloorSearch({ parties, tables, onSelectParty, onSelectTable }: HostFloorSearchProps) {
  const { colors, isDark } = useTheme();
  const searchRef = useRef<View>(null);
  const activeInputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);

  const surface = isDark ? 'rgba(30, 30, 34, 0.98)' : 'rgba(255,255,255,0.98)';

  const closeSearch = useCallback(() => {
    setOpen(false);
    setAnchor(null);
    Keyboard.dismiss();
  }, []);

  const openSearch = useCallback(() => {
    searchRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const focusTimer = setTimeout(() => activeInputRef.current?.focus(), 0);
    return () => clearTimeout(focusTimer);
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();

  const results = useMemo<SearchResult[]>(() => {
    if (!normalizedQuery) return [];
    const partyResults: SearchResult[] = parties
      .filter(
        (party) =>
          matchesQuery(party.name, normalizedQuery) ||
          matchesQuery(party.phone, normalizedQuery) ||
          matchesQuery(party.sourceLabel, normalizedQuery),
      )
      .slice(0, 8)
      .map((party) => ({ kind: 'party', party }));
    const tableResults: SearchResult[] = tables
      .filter(
        (table) =>
          matchesQuery(table.label, normalizedQuery) || matchesQuery(table.id, normalizedQuery),
      )
      .slice(0, 8)
      .map((table) => ({ kind: 'table', table }));
    return [...partyResults, ...tableResults].slice(0, 12);
  }, [normalizedQuery, parties, tables]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (result.kind === 'party') {
        onSelectParty(result.party);
      } else {
        onSelectTable(result.table.id);
      }
      closeSearch();
      setQuery('');
    },
    [closeSearch, onSelectParty, onSelectTable],
  );

  return (
    <>
      <View
        ref={searchRef}
        collapsable={false}
        pointerEvents={open ? 'none' : 'auto'}
        style={[
          styles.search,
          {
            backgroundColor: colors.surface.level1,
            borderColor: colors.border.default,
            opacity: open ? 0 : 1,
          },
        ]}
      >
        <Ionicons name="search" size={15} color={colors.text.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={openSearch}
          placeholder="Search guests, tables…"
          placeholderTextColor={colors.text.muted}
          numberOfLines={1}
          returnKeyType="search"
          style={[styles.searchInput, { color: colors.text.primary }]}
          accessibilityLabel="Search guests and tables"
        />
      </View>

      <Modal
        transparent
        visible={open}
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={closeSearch}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeSearch}
            accessibilityRole="button"
            accessibilityLabel="Dismiss search"
          />
          {anchor ? (
            <View
              style={[
                styles.panel,
                {
                  top: anchor.y,
                  left: anchor.x,
                  width: anchor.width,
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <View
                style={[
                  styles.search,
                  {
                    backgroundColor: colors.surface.level1,
                    borderColor: colors.accent,
                  },
                ]}
              >
                <Ionicons name="search" size={15} color={colors.text.muted} />
                <TextInput
                  ref={activeInputRef}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search guests, tables…"
                  placeholderTextColor={colors.text.muted}
                  numberOfLines={1}
                  returnKeyType="search"
                  style={[styles.searchInput, { color: colors.text.primary }]}
                  accessibilityLabel="Search guests and tables"
                />
                {query.length > 0 ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    hitSlop={8}
                    onPress={() => setQuery('')}
                  >
                    <Ionicons name="close-circle" size={16} color={colors.text.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <View
                style={[
                  styles.dropdown,
                  {
                    backgroundColor: surface,
                    borderColor: colors.border.default,
                  },
                ]}
              >
                <ScrollView
                  style={styles.dropdownScroll}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {normalizedQuery.length === 0 ? (
                    <Text style={[styles.hint, { color: colors.text.muted }]}>
                      Search by guest name, phone, or table number.
                    </Text>
                  ) : results.length === 0 ? (
                    <Text style={[styles.hint, { color: colors.text.muted }]}>No matches.</Text>
                  ) : (
                    results.map((result) => {
                      if (result.kind === 'party') {
                        const { party } = result;
                        return (
                          <TouchableOpacity
                            key={`party-${party.source}-${party.id}`}
                            activeOpacity={0.76}
                            style={[styles.resultRow, { borderBottomColor: colors.border.subtle }]}
                            onPress={() => handleSelect(result)}
                          >
                            <Ionicons
                              name={
                                party.source === 'waitlist' ? 'people-outline' : 'calendar-outline'
                              }
                              size={16}
                              color={colors.text.secondary}
                            />
                            <View style={styles.resultCopy}>
                              <Text
                                style={[styles.resultTitle, { color: colors.text.primary }]}
                                numberOfLines={1}
                              >
                                {party.name}
                              </Text>
                              <Text
                                style={[styles.resultMeta, { color: colors.text.muted }]}
                                numberOfLines={1}
                              >
                                {party.sourceLabel} · party of {party.size}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      }

                      const { table } = result;
                      return (
                        <TouchableOpacity
                          key={`table-${table.id}`}
                          activeOpacity={0.76}
                          style={[styles.resultRow, { borderBottomColor: colors.border.subtle }]}
                          onPress={() => handleSelect(result)}
                        >
                          <Ionicons name="grid-outline" size={16} color={colors.text.secondary} />
                          <View style={styles.resultCopy}>
                            <Text
                              style={[styles.resultTitle, { color: colors.text.primary }]}
                              numberOfLines={1}
                            >
                              Table {table.label}
                            </Text>
                            <Text style={[styles.resultMeta, { color: colors.text.muted }]}>
                              Open on floor map
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  panel: {
    position: 'absolute',
  },
  search: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: 13,
    padding: 0,
  },
  dropdown: {
    marginTop: spacing.xs,
    maxHeight: DROPDOWN_MAX_HEIGHT,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: DROPDOWN_MAX_HEIGHT,
  },
  hint: {
    ...textStyles.caption,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    ...textStyles.captionMedium,
    fontWeight: '700',
  },
  resultMeta: {
    ...textStyles.tiny,
    marginTop: 2,
  },
});
