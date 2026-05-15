import { create } from 'zustand';

type ComposerStoreState = {
  drafts: Record<string, string>;
  setDraft: (conversationId: string, text: string) => void;
  clearDraft: (conversationId: string) => void;
};

export const useComposerStore = create<ComposerStoreState>((set) => ({
  drafts: {},
  setDraft: (conversationId, text) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [conversationId]: text,
      },
    })),
  clearDraft: (conversationId) =>
    set((state) => {
      const nextDrafts = { ...state.drafts };
      delete nextDrafts[conversationId];
      return { drafts: nextDrafts };
    }),
}));
