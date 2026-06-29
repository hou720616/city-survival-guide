import { create } from "zustand";
import type { UserInput, Solution, ChatMessage, ChatContext } from "@/types";

interface AppState {
  // 用户输入
  userInput: UserInput | null;
  setUserInput: (input: UserInput) => void;

  // 生成的方案
  solution: Solution | null;
  setSolution: (solution: Solution) => void;
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // AI 对话
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  clearChat: () => void;

  // 对话上下文
  chatContext: ChatContext | null;
  setChatContext: (context: ChatContext) => void;
}

export const useAppStore = create<AppState>((set) => ({
  userInput: null,
  setUserInput: (input) => set({ userInput: input }),

  solution: null,
  setSolution: (solution) => set({ solution }),
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),

  chatMessages: [],
  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),
  updateLastAssistantMessage: (content) =>
    set((state) => {
      const messages = [...state.chatMessages];
      const lastIdx = messages.length - 1;
      if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
        messages[lastIdx] = { ...messages[lastIdx], content };
      }
      return { chatMessages: messages };
    }),
  clearChat: () => set({ chatMessages: [] }),

  chatContext: null,
  setChatContext: (context) => set({ chatContext: context }),
}));
