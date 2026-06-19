"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface Chat {
  id: string;
  name: string;
  type: string;
  workspace_id: string;
  last_message?: string;
  last_message_at?: string;
  created_at: string;
  display_name?: string;
  display_avatar?: string;
  display_avatar_preset?: string;
}

interface FloatingChatContextType {
  floatingBubbles: Chat[];
  expandedChannelId: string | null;
  addBubble: (chat: Chat) => void;
  removeBubble: (chatId: string) => void;
  toggleExpand: (chatId: string | null) => void;
}

const FloatingChatContext = createContext<FloatingChatContextType | undefined>(undefined);

export function FloatingChatProvider({ children }: { children: React.ReactNode }) {
  const [floatingBubbles, setFloatingBubbles] = useState<Chat[]>([]);
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null);

  const addBubble = useCallback((chat: Chat) => {
    setFloatingBubbles(prev => {
      if (prev.some(b => b.id === chat.id)) return prev;
      return [...prev, chat];
    });
    setExpandedChannelId(chat.id);
  }, []);

  const removeBubble = useCallback((chatId: string) => {
    setFloatingBubbles(prev => prev.filter(b => b.id !== chatId));
    if (expandedChannelId === chatId) setExpandedChannelId(null);
  }, [expandedChannelId]);

  const toggleExpand = useCallback((chatId: string | null) => {
    setExpandedChannelId(prev => prev === chatId ? null : chatId);
  }, []);

  return (
    <FloatingChatContext.Provider value={{
      floatingBubbles,
      expandedChannelId,
      addBubble,
      removeBubble,
      toggleExpand
    }}>
      {children}
    </FloatingChatContext.Provider>
  );
}

export const useFloatingChat = () => {
  const context = useContext(FloatingChatContext);
  if (context === undefined) {
    throw new Error('useFloatingChat must be used within a FloatingChatProvider');
  }
  return context;
};
