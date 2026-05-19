import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { type StatusKey, shadows, textStyles, useTheme } from '@/theme';
import { sectionColorWithAlpha } from '@/features/floor';
import { ServerAvatar } from './ServerAvatar';

type TableShape = 'circle' | 'square' | 'horizontal';

type TableProps = {
  id: string;
  status: StatusKey;
  shape?: TableShape;
  capacity?: number;
  onPress?: () => void;
  /** A blocked table overrides the status palette with the blocked gray. */
  isBlocked?: boolean;
  /** Selected = accent ring + soft lift. */
  selected?: boolean;
  /** One live datum under the number — a seated timer or an RSV time. */
  liveDatum?: string;
  /** The server who owns this table — shown as a corner avatar badge. */
  server?: { initials: string; color: string };
  dimmed?: boolean;
  sectionColor?: string;
  /** Custom size in px — overrides the shape default. */
  width?: number;
  height?: number;
};

const SHAPE_STYLES: Record<TableShape, ViewStyle> = {
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  square: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  horizontal: {
    width: 140,
    height: 64,
    borderRadius: 8,
  },
};

export function Table({
  id,
  status,
  shape = 'square',
  capacity,
  onPress,
  isBlocked,
  selected,
  liveDatum,
  server,
  dimmed,
  sectionColor,
  width,
  height,
}: TableProps) {
  const { colors } = useTheme();
  const palette = isBlocked ? colors.blocked : colors.status[status];

  // Available tables stay light & clean (they read as "empty / ready").
  // Occupied / dirty / reserved / blocked are solid color blocks — the
  // crisp, glance-readable Yelp host-floor treatment.
  const isSolid = isBlocked || status !== 'available';
  const bg = isSolid
    ? palette.border
    : sectionColor
      ? sectionColorWithAlpha(sectionColor, 0.16)
      : palette.fill;
  const numberColor = isSolid ? '#FFFFFF' : colors.text.primary;
  const subColor = isSolid ? 'rgba(255,255,255,0.82)' : colors.text.muted;
  const datumColor = isSolid ? 'rgba(255,255,255,0.92)' : palette.text;
  const edgeColor = isSolid ? palette.text : (sectionColor ?? palette.border);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        viewStyles.tableBase,
        SHAPE_STYLES[shape],
        width != null ? { width } : null,
        height != null ? { height } : null,
        { backgroundColor: bg, borderColor: edgeColor },
        selected ? { borderColor: colors.accent, borderWidth: 3, ...shadows.elevated } : null,
        dimmed ? { opacity: 0.4 } : null,
      ]}
    >
      <Text style={[textBlocks.tableNumber, { color: numberColor }]}>{id}</Text>
      {capacity != null && (
        <Text style={[textBlocks.capacity, { color: subColor }]}>{capacity}p</Text>
      )}
      {liveDatum != null && (
        <Text style={[textBlocks.liveDatum, { color: datumColor }]} numberOfLines={1}>
          {liveDatum}
        </Text>
      )}
      {server != null && (
        <View style={viewStyles.avatarSlot}>
          <ServerAvatar initials={server.initials} color={server.color} size={22} />
        </View>
      )}
      {sectionColor ? (
        <View style={[viewStyles.sectionStripe, { backgroundColor: sectionColor }]} />
      ) : null}
    </TouchableOpacity>
  );
}

const viewStyles = StyleSheet.create({
  tableBase: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    ...shadows.subtle,
  },
  avatarSlot: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  sectionStripe: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 5,
    height: 4,
    borderRadius: 2,
  },
});

const textBlocks = StyleSheet.create<{
  tableNumber: TextStyle;
  capacity: TextStyle;
  liveDatum: TextStyle;
}>({
  tableNumber: {
    ...textStyles.tableNumber,
    fontVariant: ['tabular-nums'],
    lineHeight: 24,
  },
  capacity: {
    ...textStyles.tiny,
    marginTop: 1,
  },
  liveDatum: {
    fontFamily: textStyles.captionMedium.fontFamily,
    fontSize: 10,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
});
