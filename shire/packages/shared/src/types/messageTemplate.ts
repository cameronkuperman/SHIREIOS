export type MessageTemplateCategory = "waitlist" | "reservation" | "host";

export interface MessageTemplate {
  id: string;
  key: string;
  name: string;
  category: MessageTemplateCategory;
  body: string;
  channel: "sms";
  active: boolean;
  systemDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMessageTemplateRequest {
  key: string;
  name: string;
  category: MessageTemplateCategory;
  body: string;
  channel?: "sms";
  active?: boolean;
}

export type UpdateMessageTemplateRequest = Partial<
  Pick<MessageTemplate, "name" | "category" | "body" | "active">
>;
