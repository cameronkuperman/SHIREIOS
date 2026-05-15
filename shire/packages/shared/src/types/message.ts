export type MessageDirection = "inbound" | "outbound";
export type MessageChannel = "sms";
export type MessageProvider = "sendblue" | "twilio" | null;
export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "received"
  | "failed"
  | "not_sent"
  | "opted_out";

export interface Conversation {
  id: string;
  guestId: string | null;
  displayName: string;
  phoneE164: string;
  phoneLast4: string;
  activeReservationId: string | null;
  activeWaitlistId: string | null;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  guestId: string | null;
  reservationId: string | null;
  waitlistId: string | null;
  direction: MessageDirection;
  channel: MessageChannel;
  body: string;
  templateId: string | null;
  templateKey: string | null;
  status: MessageStatus;
  provider: MessageProvider;
  providerMessageId: string | null;
  errorMessage: string | null;
  actorUserId: string | null;
  readAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageRequest {
  conversationId?: string;
  reservationId?: string;
  waitlistId?: string;
  guestId?: string;
  phone?: string;
  templateId?: string;
  templateKey?: string;
  body?: string;
}

export interface SendMessageResponse {
  conversation: Conversation;
  message: Message;
}
