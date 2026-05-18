import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily } from '@/theme';

type ServerAvatarProps = {
  initials: string;
  color: string;
  size?: number;
};

/** Small colored circle with a server's initials. */
export function ServerAvatar({ initials, color, size = 22 }: ServerAvatarProps) {
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.42) }]} numberOfLines={1}>
        {initials.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  initials: {
    fontFamily: fontFamily.sansBold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
