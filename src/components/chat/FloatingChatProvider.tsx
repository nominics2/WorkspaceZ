"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

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
  totalUnreadCount: number;
  addBubble: (chat: Chat) => void;
  removeBubble: (chatId: string) => void;
  toggleExpand: (chatId: string | null) => void;
  refreshUnread: () => Promise<void>;
}

const FloatingChatContext = createContext<FloatingChatContextType | undefined>(undefined);

export function FloatingChatProvider({ children }: { children: React.ReactNode }) {
  const [floatingBubbles, setFloatingBubbles] = useState<Chat[]>([]);
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  
  const supabase = createClient();

  const fetchUnreadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setTotalUnreadCount(0);
        return;
      }

      const [unreadRes, muteRes] = await Promise.all([
        supabase.rpc("get_chat_unread_counts"),
        supabase.rpc("get_chat_mute_states")
      ]);

      if (unreadRes.error) return;
      
      const unreadData = (unreadRes.data || []) as any[];
      const muteData = (muteRes.data || []) as any[];

      const total = unreadData.reduce((acc: number, curr: any) => {
        const isMuted = muteData.some((m: any) => 
          m.channel_id === curr.channel_id && 
          m.is_muted && 
          (!m.muted_until || new Date(m.muted_until) > new Date())
        );
        
        if (isMuted) return acc;
        return acc + (curr.unread_count || 0);
      }, 0);

      setTotalUnreadCount(total);
    } catch (err) {
      // Silently handle errors in background refresh
    }
  }, [supabase]);

  useEffect(() => {
    fetchUnreadData();

    const channel = supabase
      .channel('chat_global_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
        fetchUnreadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_channel_read_states' }, () => {
        fetchUnreadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_channel_mutes' }, () => {
        fetchUnreadData();
      })
      .subscribe();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setTotalUnreadCount(0);
        setFloatingBubbles([]);
        setExpandedChannelId(null);
      } else {
        fetchUnreadData();
      }
    });

    return () => {
      supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, [supabase, fetchUnreadData]);

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
      totalUnreadCount,
      addBubble,
      removeBubble,
      toggleExpand,
      refreshUnread: fetchUnreadData
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
