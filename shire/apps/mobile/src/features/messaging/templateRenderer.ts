import type { MessageTemplate } from '@shire/shared';

export type TemplatePreviewContext = {
  restaurantName?: string | null;
  partySize?: number | string | null;
  reservationLabel?: string | null;
  messageBody?: string | null;
};

export function renderPreview(
  template: Pick<MessageTemplate, 'body'> | string,
  context: TemplatePreviewContext,
): string {
  const body = typeof template === 'string' ? template : template.body;
  const values: Record<string, string> = {
    restaurantName: context.restaurantName?.toString() || 'Restaurant',
    partySize: context.partySize?.toString() || 'party',
    reservationLabel: context.reservationLabel?.toString() || 'your reservation',
    messageBody: context.messageBody?.toString() || '',
  };

  return body.replace(/\{(restaurantName|partySize|reservationLabel|messageBody)\}/g, (_, key) => {
    return values[key] ?? '';
  });
}
