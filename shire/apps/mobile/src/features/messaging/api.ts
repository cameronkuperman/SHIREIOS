import type {
  Conversation,
  CreateMessageTemplateRequest,
  Message,
  MessageTemplate,
  SendMessageRequest,
  SendMessageResponse,
  UpdateMessageTemplateRequest,
  WaitlistEntry,
} from '@shire/shared';
import { apiClient } from '@/services/api/client';
import { adaptWaitlistEntry, type WaitlistEntryDto } from '@/features/host/contracts';
import {
  adaptConversation,
  adaptMessage,
  adaptTemplate,
  type ConversationDetailResponseDto,
  type ConversationsResponseDto,
  type MessageTemplateDto,
  type SendMessageResponseDto,
} from './contracts';

export type ConversationFilters = {
  search?: string;
  includeArchived?: boolean;
};

export async function fetchConversations(
  locationId: string,
  filters: ConversationFilters = {},
): Promise<Conversation[]> {
  const response = await apiClient.get<ConversationsResponseDto>(
    `/locations/${locationId}/messages/conversations`,
    {
      params: {
        limit: 50,
        ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
        ...(filters.includeArchived ? { includeArchived: true } : {}),
      },
    },
  );
  return response.data.conversations.map(adaptConversation);
}

export async function fetchConversation(
  locationId: string,
  conversationId: string,
): Promise<{ conversation: Conversation; messages: Message[] }> {
  const response = await apiClient.get<ConversationDetailResponseDto>(
    `/locations/${locationId}/messages/conversations/${conversationId}`,
    { params: { limit: 100 } },
  );
  return {
    conversation: adaptConversation(response.data.conversation),
    messages: response.data.messages.map(adaptMessage),
  };
}

export async function sendMessage(
  locationId: string,
  input: SendMessageRequest,
): Promise<SendMessageResponse> {
  const response = await apiClient.post<SendMessageResponseDto>(
    `/locations/${locationId}/messages/send`,
    input,
  );
  return {
    conversation: adaptConversation(response.data.conversation),
    message: adaptMessage(response.data.message),
  };
}

export async function markConversationRead(
  locationId: string,
  conversationId: string,
): Promise<{ conversationId: string; unreadCount: number }> {
  const response = await apiClient.post<{ conversationId: string; unreadCount: number }>(
    `/locations/${locationId}/messages/conversations/${conversationId}/read`,
    {},
  );
  return response.data;
}

export async function fetchMessageTemplates(locationId: string): Promise<MessageTemplate[]> {
  const response = await apiClient.get<MessageTemplateDto[]>(
    `/locations/${locationId}/message-templates`,
  );
  return response.data.map(adaptTemplate);
}

export async function createMessageTemplate(
  locationId: string,
  input: CreateMessageTemplateRequest,
): Promise<MessageTemplate> {
  const response = await apiClient.post<MessageTemplateDto>(
    `/locations/${locationId}/message-templates`,
    { channel: 'sms', active: true, ...input },
  );
  return adaptTemplate(response.data);
}

export async function updateMessageTemplate(
  locationId: string,
  templateId: string,
  input: UpdateMessageTemplateRequest,
): Promise<MessageTemplate> {
  const response = await apiClient.patch<MessageTemplateDto>(
    `/locations/${locationId}/message-templates/${templateId}`,
    input,
  );
  return adaptTemplate(response.data);
}

export async function notifyWaitlistEntry(
  locationId: string,
  entryId: string,
  input: {
    templateId?: string;
    templateKey?: string;
    messageBody?: string;
    notes?: string;
    commandId?: string;
  } = {},
): Promise<WaitlistEntry> {
  const response = await apiClient.post<WaitlistEntryDto>(
    `/locations/${locationId}/waitlist/${entryId}/actions/notify`,
    input,
  );
  return adaptWaitlistEntry(response.data);
}
