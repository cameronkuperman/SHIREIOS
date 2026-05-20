import React, { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

type HostTextFieldProps = TextInputProps & {
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export function HostTextField({
  iconName,
  containerStyle,
  inputStyle,
  style,
  placeholderTextColor,
  ...inputProps
}: HostTextFieldProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  return (
    <Pressable
      accessible={false}
      onPress={() => inputRef.current?.focus()}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface.level2,
          borderColor: colors.glass.borderSubtle,
        },
        containerStyle,
      ]}
    >
      {iconName && <Ionicons name={iconName} size={18} color={colors.text.muted} />}
      <TextInput
        ref={inputRef}
        style={[styles.input, { color: colors.text.primary }, style, inputStyle]}
        placeholderTextColor={placeholderTextColor ?? colors.text.muted}
        {...inputProps}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    ...textStyles.body,
    padding: 0,
  },
});
