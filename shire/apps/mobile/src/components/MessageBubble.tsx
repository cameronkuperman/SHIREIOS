import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Message, SendMessageRequest } from '@shire/shared';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

type RetryMessageRequest = SendMessageRequest & {
  retryMessageId: string;
};

type MessageBubbleProps = {
  message: Message;
  onRetry?: (payload: RetryMessageRequest) => void;
};

function statusNeedsRetry(status: Message['status']): boolean {
  return status === 'failed' || status === 'not_sent';
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const { colors } = useTheme();
  const outbound = message.direction === 'outbound';
  const failed = statusNeedsRetry(message.status);
  const optedOut = message.status === 'opted_out';

  return (
    <View style={[styles.wrap, outbound ? styles.outboundWrap : styles.inboundWrap]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: outbound ? colors.accent : colors.surface.level2,
            borderColor: outbound ? colors.accent : colors.glass.border,
          },
        ]}
      >
        <Text style={[styles.body, { color: outbound ? colors.white : colors.text.primary }]}>
          {message.body || (message.templateKey ? `Template: ${message.templateKey}` : '')}
        </Text>
      </View>
      {(failed || optedOut) && (
        <View style={[styles.errorRow, { backgroundColor: colors.status.dirty.fill }]}>
          <Text style={[styles.errorText, { color: colors.status.dirty.text }]}>
            {message.errorMessage ?? (optedOut ? 'Guest opted out' : 'Message was not sent')}
          </Text>
          {failed && onRetry && (
            <TouchableOpacity
              onPress={() =>
                onRetry({
                  retryMessageId: message.id,
                  conversationId: message.conversationId,
                  reservationId: message.reservationId ?? undefined,
                  waitlistId: message.waitlistId ?? undefined,
                  guestId: message.guestId ?? undefined,
                  body: message.body,
                })
              }
            >
              <Text style={[styles.retryText, { color: colors.status.dirty.text }]}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.sm,
    maxWidth: '82%',
  },
  inboundWrap: {
    alignSelf: 'flex-start',
  },
  outboundWrap: {
    alignSelf: 'flex-end',
  },
  bubble: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  body: {
    ...textStyles.body,
  },
  errorRow: {
    marginTop: spacing.xs,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  errorText: {
    ...textStyles.tiny,
    flex: 1,
  },
  retryText: {
    ...textStyles.tiny,
    fontWeight: '700',
  },
});
