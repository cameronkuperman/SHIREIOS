import type { QueryClient } from '@tanstack/react-query';
import type { Conversation } from '@shire/shared';
import { queryKeys } from '@/services/api/queryKeys';

export function selectTotalUnreadFromConversations(
  conversations: Conversation[] | undefined,
): number {
  return (conversations ?? []).reduce((total, conversation) => total + conversation.unreadCount, 0);
}

export function selectCachedTotalUnread(queryClient: QueryClient, locationId: string): number {
  const queries = queryClient.getQueriesData<Conversation[]>({
    queryKey: queryKeys.messaging.conversations(locationId),
  });
  return queries.reduce(
    (total, [, conversations]) => total + selectTotalUnreadFromConversations(conversations),
    0,
  );
}
