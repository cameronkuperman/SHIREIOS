import { useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Conversation,
  CreateMessageTemplateRequest,
  Message,
  SendMessageRequest,
  UpdateMessageTemplateRequest,
} from '@shire/shared';
import { useAuth } from '@/features/auth';
import { upsertWaitlistEntry } from '@/features/host/contracts';
import { queryKeys } from '@/services/api/queryKeys';
import { usePolling } from '@/lib/usePolling';
import {
  createMessageTemplate,
  fetchConversation,
  fetchConversations,
  fetchMessageTemplates,
  markConversationRead,
  notifyWaitlistEntry,
  sendMessage,
  updateMessageTemplate,
  type ConversationFilters,
} from './api';
import { sortMessages } from './contracts';
import { selectTotalUnreadFromConversations } from './unreadSelectors';

export type SendMessageMutationInput = SendMessageRequest & {
  retryMessageId?: string;
};

function useLocationId(): string | null {
  const { currentLocation } = useAuth();
  return currentLocation?.id ?? null;
}

function updateConversationInLists(
  conversations: Conversation[] | undefined,
  nextConversation: Conversation,
): Conversation[] {
  const current = conversations ?? [];
  const index = current.findIndex((conversation) => conversation.id === nextConversation.id);
  const next =
    index === -1
      ? [nextConversation, ...current]
      : current.map((conversation) =>
          conversation.id === nextConversation.id ? nextConversation : conversation,
        );
  return next.sort(
    (left, right) =>
      new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime(),
  );
}

function appendMessage(messages: Message[], nextMessage: Message): Message[] {
  return sortMessages([
    ...messages.filter((message) => message.id !== nextMessage.id),
    nextMessage,
  ]);
}

export function useConversations(filters: ConversationFilters = {}) {
  const locationId = useLocationId();
  const queryRef = useRef<() => void>(() => undefined);
  const polling = usePolling(() => queryRef.current(), {
    foregroundMs: 15_000,
    backgroundMs: 30_000,
    enabled: !!locationId,
  });

  const query = useQuery({
    queryKey: locationId
      ? queryKeys.messaging.conversations(locationId, filters)
      : ['messaging', 'conversations', 'disabled'],
    queryFn: () => fetchConversations(locationId!, filters),
    enabled: !!locationId,
    ...polling,
  });

  queryRef.current = () => {
    void query.refetch();
  };

  return query;
}

export function useConversation(conversationId: string | null) {
  const locationId = useLocationId();
  const queryRef = useRef<() => void>(() => undefined);
  const polling = usePolling(() => queryRef.current(), {
    foregroundMs: 5_000,
    backgroundMs: 30_000,
    enabled: !!locationId && !!conversationId,
  });

  const query = useQuery({
    queryKey:
      locationId && conversationId
        ? queryKeys.messaging.conversation(locationId, conversationId)
        : ['messaging', 'conversation', 'disabled'],
    queryFn: () => fetchConversation(locationId!, conversationId!),
    enabled: !!locationId && !!conversationId,
    ...polling,
    select: (data) => ({
      conversation: data.conversation,
      messages: sortMessages(data.messages),
    }),
  });

  queryRef.current = () => {
    void query.refetch();
  };

  return query;
}

export function useTemplates() {
  const locationId = useLocationId();

  return useQuery({
    queryKey: locationId ? queryKeys.messaging.templates(locationId) : ['messaging', 'templates'],
    queryFn: () => fetchMessageTemplates(locationId!),
    enabled: !!locationId,
    staleTime: 5 * 60_000,
  });
}

export function useSendMessage() {
  const locationId = useLocationId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SendMessageMutationInput) => {
      const { retryMessageId: _retryMessageId, ...request } = input;
      return sendMessage(locationId!, request);
    },
    onMutate: async (input) => {
      if (!locationId || !input.conversationId) {
        return { optimisticId: null };
      }

      const optimisticId = `tmp_${Date.now()}`;
      const optimisticMessage: Message = {
        id: optimisticId,
        conversationId: input.conversationId,
        guestId: input.guestId ?? null,
        reservationId: input.reservationId ?? null,
        waitlistId: input.waitlistId ?? null,
        direction: 'outbound',
        channel: 'sms',
        body: input.body ?? '',
        templateId: input.templateId ?? null,
        templateKey: input.templateKey ?? null,
        status: 'queued',
        provider: null,
        providerMessageId: null,
        errorMessage: null,
        actorUserId: null,
        readAt: null,
        sentAt: null,
        deliveredAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<{ conversation: Conversation; messages: Message[] }>(
        queryKeys.messaging.conversation(locationId, input.conversationId),
        (current) =>
          current
            ? {
                ...current,
                messages: appendMessage(
                  current.messages.filter((message) => message.id !== input.retryMessageId),
                  optimisticMessage,
                ),
              }
            : current,
      );

      return { optimisticId, retryMessageId: input.retryMessageId };
    },
    onSuccess: (response, _input, context) => {
      if (!locationId) {
        return;
      }

      queryClient.setQueriesData<Conversation[]>(
        { queryKey: queryKeys.messaging.conversations(locationId) },
        (current) => updateConversationInLists(current, response.conversation),
      );

      queryClient.setQueryData<{ conversation: Conversation; messages: Message[] }>(
        queryKeys.messaging.conversation(locationId, response.conversation.id),
        // A retry has two client-only rows to clean up: the old failed bubble and
        // the new queued optimistic bubble created for the retry attempt.
        (current) => ({
          conversation: response.conversation,
          messages: appendMessage(
            (current?.messages ?? []).filter(
              (message) =>
                message.id !== context?.optimisticId &&
                message.id !== context?.retryMessageId,
            ),
            response.message,
          ),
        }),
      );

      void queryClient.invalidateQueries({
        queryKey: queryKeys.messaging.conversations(locationId),
      });
    },
    onError: (error, input, context) => {
      if (!locationId || !input.conversationId || !context?.optimisticId) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Message failed to send.';
      queryClient.setQueryData<{ conversation: Conversation; messages: Message[] }>(
        queryKeys.messaging.conversation(locationId, input.conversationId),
        (current) =>
          current
            ? {
                ...current,
                messages: current.messages.map((existing) =>
                  existing.id === context.optimisticId
                    ? {
                        ...existing,
                        status: 'failed',
                        errorMessage: message,
                        updatedAt: new Date().toISOString(),
                      }
                    : existing,
                ),
              }
            : current,
      );
    },
  });
}

export function useMarkRead() {
  const locationId = useLocationId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => markConversationRead(locationId!, conversationId),
    onSuccess: ({ conversationId }) => {
      if (!locationId) {
        return;
      }

      queryClient.setQueriesData<Conversation[]>(
        { queryKey: queryKeys.messaging.conversations(locationId) },
        (current) =>
          (current ?? []).map((conversation) =>
            conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
          ),
      );
    },
  });
}

export function useCreateTemplate() {
  const locationId = useLocationId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMessageTemplateRequest) => createMessageTemplate(locationId!, input),
    onSuccess: () => {
      if (locationId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.messaging.templates(locationId) });
      }
    },
  });
}

export function useUpdateTemplate() {
  const locationId = useLocationId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      input,
    }: {
      templateId: string;
      input: UpdateMessageTemplateRequest;
    }) => updateMessageTemplate(locationId!, templateId, input),
    onSuccess: () => {
      if (locationId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.messaging.templates(locationId) });
      }
    },
  });
}

export function useWaitlistNotify() {
  const locationId = useLocationId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entryId,
      input,
    }: {
      entryId: string;
      input?: Parameters<typeof notifyWaitlistEntry>[2];
    }) => notifyWaitlistEntry(locationId!, entryId, input ?? {}),
    onSuccess: (entry) => {
      if (!locationId) {
        return;
      }

      queryClient.setQueryData<import('@shire/shared').WaitlistEntry[]>(
        queryKeys.waitlist.list(locationId),
        (current) => upsertWaitlistEntry(current ?? [], entry),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.waitlist.list(locationId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.messaging.conversations(locationId),
      });
    },
  });
}

export function useTotalUnread(): number {
  const query = useConversations();
  return useMemo(() => selectTotalUnreadFromConversations(query.data), [query.data]);
}
