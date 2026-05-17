import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FloorMapRoom } from '@shire/shared';
import { borderRadius, shadows, spacing, textStyles, useTheme } from '@/theme';

type RoomDraft = FloorMapRoom & { _isNew?: boolean };

export type ManageRoomsResult = {
  rooms: FloorMapRoom[];
  deletedRoomIds: string[];
};

type ManageRoomsSheetProps = {
  visible: boolean;
  onClose: () => void;
  rooms: FloorMapRoom[];
  tableCountByRoom: Record<string, number>;
  onSave: (result: ManageRoomsResult) => Promise<void> | void;
};

function makeNewRoom(existingIds: Set<string>): RoomDraft {
  let n = existingIds.size + 1;
  let id = `room-${n}`;
  while (existingIds.has(id)) {
    n += 1;
    id = `room-${n}`;
  }
  const label = `Room ${n}`;
  return {
    roomId: id,
    label: label.toUpperCase(),
    filterLabel: label,
    flex: 1,
    variant: 'default',
    rows: [],
    layoutMode: 'freeform',
    _isNew: true,
  };
}

export function ManageRoomsSheet({
  visible,
  onClose,
  rooms,
  tableCountByRoom,
  onSave,
}: ManageRoomsSheetProps) {
  const { colors, isDark } = useTheme();
  const [drafts, setDrafts] = useState<RoomDraft[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDrafts(rooms.map((r) => ({ ...r })));
      setDeletedIds([]);
    }
  }, [visible, rooms]);

  const existingIds = useMemo(() => new Set(drafts.map((d) => d.roomId)), [drafts]);

  const handleAdd = () => {
    setDrafts((prev) => [...prev, makeNewRoom(existingIds)]);
  };

  const handleRename = (roomId: string, nextLabel: string) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.roomId === roomId
          ? { ...d, filterLabel: nextLabel, label: nextLabel.trim().toUpperCase() || d.label }
          : d,
      ),
    );
  };

  const handleDelete = (room: RoomDraft) => {
    const tableCount = tableCountByRoom[room.roomId] ?? 0;
    const message =
      tableCount > 0
        ? `Delete "${room.filterLabel}" and its ${tableCount} table${tableCount === 1 ? '' : 's'}?`
        : `Delete "${room.filterLabel}"?`;

    Alert.alert('Delete Room', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDrafts((prev) => prev.filter((d) => d.roomId !== room.roomId));
          if (!room._isNew) {
            setDeletedIds((prev) => [...prev, room.roomId]);
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    const trimmed = drafts.map((d) => ({
      ...d,
      filterLabel: d.filterLabel.trim() || 'Untitled',
      label: (d.label.trim() || d.filterLabel.trim() || 'Untitled').toUpperCase(),
    }));

    const seen = new Set<string>();
    for (const room of trimmed) {
      const key = room.filterLabel.toLowerCase();
      if (seen.has(key)) {
        Alert.alert('Duplicate Names', `Two rooms share the name "${room.filterLabel}".`);
        return;
      }
      seen.add(key);
    }

    if (trimmed.length === 0) {
      Alert.alert('At Least One Room', 'You must have at least one room.');
      return;
    }

    setIsSaving(true);
    try {
      const cleaned: FloorMapRoom[] = trimmed.map(({ _isNew, ...room }) => room);
      await onSave({ rooms: cleaned, deletedRoomIds: deletedIds });
      onClose();
    } catch (error) {
      Alert.alert('Save Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? 'rgba(30, 30, 34, 0.96)' : 'rgba(255,255,255,0.98)',
              borderColor: colors.glass.border,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
            <Text style={[styles.title, { color: colors.text.primary }]}>Manage Rooms</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {drafts.map((room) => {
              const tableCount = tableCountByRoom[room.roomId] ?? 0;
              return (
                <View
                  key={room.roomId}
                  style={[
                    styles.row,
                    {
                      backgroundColor: colors.surface.level1,
                      borderColor: colors.border.default,
                    },
                  ]}
                >
                  <TextInput
                    value={room.filterLabel}
                    onChangeText={(text) => handleRename(room.roomId, text)}
                    placeholder="Room name"
                    placeholderTextColor={colors.text.muted}
                    style={[styles.input, { color: colors.text.primary }]}
                  />
                  <Text style={[styles.tableCount, { color: colors.text.muted }]}>
                    {tableCount} table{tableCount === 1 ? '' : 's'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDelete(room)}
                    hitSlop={8}
                    style={styles.deleteButton}
                    accessibilityLabel={`Delete ${room.filterLabel}`}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.status.dirty.text} />
                  </TouchableOpacity>
                </View>
              );
            })}

            <TouchableOpacity
              style={[styles.addButton, { borderColor: colors.border.strong }]}
              onPress={handleAdd}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color={colors.accent} />
              <Text style={[styles.addLabel, { color: colors.accent }]}>Add Room</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border.subtle }]}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.footerButton, { borderColor: colors.border.default }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.footerButtonText, { color: colors.text.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              style={[
                styles.footerButton,
                styles.footerPrimary,
                { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.footerButtonText, { color: colors.white }]}>
                {isSaving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '80%',
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.elevated,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  title: {
    ...textStyles.subtitle,
  },
  list: {
    maxHeight: 460,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    ...textStyles.body,
    paddingVertical: spacing.xs,
  },
  tableCount: {
    ...textStyles.caption,
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: spacing.xs,
  },
  addLabel: {
    ...textStyles.label,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerPrimary: {
    borderWidth: 0,
  },
  footerButtonText: {
    ...textStyles.label,
    fontWeight: '600',
  },
});
