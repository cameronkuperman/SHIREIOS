import React from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { CreateBlackoutRequest } from '@shire/shared';
import { BlackoutForm } from '@/components/BlackoutForm';
import { useCreateBlackout } from '@/features/blackouts/hooks';
import { extractHostRequestErrorMessage } from '@/features/host/errors';
import { spacing, textStyles, useTheme } from '@/theme';

export default function NewBlackoutScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const mutation = useCreateBlackout();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>New Blackout</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <BlackoutForm
          isSaving={mutation.isPending}
          onSubmit={async (values) => {
            try {
              await mutation.mutateAsync(values as CreateBlackoutRequest);
              router.back();
            } catch (error) {
              Alert.alert(
                'Unable to Save',
                extractHostRequestErrorMessage(error, 'Blackout could not be saved.'),
              );
            }
          }}
        />
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
  title: { ...textStyles.subtitle },
  content: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
});
