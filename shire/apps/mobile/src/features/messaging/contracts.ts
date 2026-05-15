import type {
  Conversation,
  CreateMessageTemplateRequest,
  Message,
  MessageTemplate,
  MessageTemplateCategory,
  SendMessageResponse,
  UpdateMessageTemplateRequest,
} from '@shire/shared';

export type ConversationDto = Conversation;
export type MessageDto = Message;
export type MessageTemplateDto = MessageTemplate;
export type CreateMessageTemplateDto = CreateMessageTemplateRequest;
export type UpdateMessageTemplateDto = UpdateMessageTemplateRequest;

export interface ConversationsResponseDto {
  conversations: ConversationDto[];
}

export interface ConversationDetailResponseDto {
  conversation: ConversationDto;
  messages: MessageDto[];
}

export type SendMessageResponseDto = SendMessageResponse;

function normalizeCategory(category: string): MessageTemplateCategory {
  switch (category) {
    case 'waitlist':
    case 'reservation':
    case 'host':
      return category;
    default:
      return 'host';
  }
}

export function adaptConversation(conversation: ConversationDto): Conversation {
  return {
    ...conversation,
    displayName: conversation.displayName?.trim() || 'Unknown',
    phoneLast4: conversation.phoneLast4 || conversation.phoneE164.slice(-4),
    unreadCount: conversation.unreadCount ?? 0,
    archivedAt: conversation.archivedAt ?? null,
  };
}

export function adaptMessage(message: MessageDto): Message {
  return {
    ...message,
    provider: message.provider ?? null,
    errorMessage: message.errorMessage ?? null,
    readAt: message.readAt ?? null,
    sentAt: message.sentAt ?? null,
    deliveredAt: message.deliveredAt ?? null,
  };
}

export function adaptTemplate(template: MessageTemplateDto): MessageTemplate {
  return {
    ...template,
    category: normalizeCategory(template.category),
    active: template.active ?? true,
    systemDefault: template.systemDefault ?? false,
  };
}

export function sortMessages(messages: Message[]): Message[] {
  return [...messages].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}
