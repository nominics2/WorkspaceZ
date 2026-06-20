"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/components/providers/WorkspaceProvider';

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
  other_user_id?: string;
  other_user_last_seen?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
}

export interface PresenceUser {
  user_id: string;
  full_name: string;
  avatar_url: string;
  avatar_preset: string;
  online_at: string;
}

export interface ChatNotificationPreferences {
  workspace_id: string;
  user_id: string;
  in_app_enabled: boolean;
  browser_enabled: boolean;
  sound_enabled: boolean;
  show_message_preview: boolean;
  updated_at: string;
}

export interface StackPosition {
  side: 'left' | 'right';
  bottomOffset: number;
}

interface FloatingChatContextType {
  floatingBubbles: Chat[];
  expandedChannelId: string | null;
  totalUnreadCount: number;
  onlineUsers: Record<string, PresenceUser>;
  notificationPrefs: ChatNotificationPreferences | null;
  muteStates: Record<string, { is_muted: boolean, muted_until: string | null }>;
  stackPosition: StackPosition;
  addBubble: (chat: Chat) => void;
  removeBubble: (chatId: string) => void;
  toggleExpand: (chatId: string | null) => void;
  updateStackPosition: (pos: StackPosition) => void;
  refreshUnread: () => Promise<void>;
  refreshNotificationPrefs: () => Promise<void>;
  updateNotificationPrefs: (prefs: Partial<ChatNotificationPreferences>) => Promise<void>;
  playNotificationSound: () => void;
}

const FloatingChatContext = createContext<FloatingChatContextType | undefined>(undefined);

const BUBBLE_STORAGE_KEY = 'workspacez_floating_chat_bubbles';
const POSITION_STORAGE_KEY = 'workspacez_floating_chat_position';

export function FloatingChatProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace, userProfile } = useWorkspace();
  const [floatingBubbles, setFloatingBubbles] = useState<Chat[]>([]);
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceUser>>({});
  const [notificationPrefs, setNotificationPrefs] = useState<ChatNotificationPreferences | null>(null);
  const [muteStates, setMuteStates] = useState<Record<string, { is_muted: boolean, muted_until: string | null }>>({});
  const [stackPosition, setStackPosition] = useState<StackPosition>({ side: 'right', bottomOffset: 24 });
  
  const lastSoundPlayRef = useRef<number>(0);
  const isHydratedRef = useRef<boolean>(false);
  const supabase = createClient();

  const fetchNotificationPrefs = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const { data, error } = await supabase.rpc("get_chat_notification_preferences", {
        p_workspace_id: activeWorkspace.id
      });
      if (!error && data) {
        setNotificationPrefs(data as ChatNotificationPreferences);
      }
    } catch (err) {
      console.error("[FloatingChat] Failed to fetch notification preferences:", err);
    }
  }, [activeWorkspace, supabase]);

  const updateNotificationPrefs = useCallback(async (updates: Partial<ChatNotificationPreferences>) => {
    if (!activeWorkspace || !notificationPrefs) return;

    const newPrefs = { ...notificationPrefs, ...updates };
    
    try {
      const { error } = await supabase.rpc("update_chat_notification_preferences", {
        p_workspace_id: activeWorkspace.id,
        p_in_app_enabled: newPrefs.in_app_enabled,
        p_browser_enabled: newPrefs.browser_enabled,
        p_sound_enabled: newPrefs.sound_enabled,
        p_show_message_preview: newPrefs.show_message_preview
      });

      if (error) throw error;
      setNotificationPrefs(newPrefs);
    } catch (err) {
      console.error("[FloatingChat] Failed to update notification preferences:", err);
      throw err;
    }
  }, [activeWorkspace, notificationPrefs, supabase]);

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

      const mutes: Record<string, { is_muted: boolean, muted_until: string | null }> = {};
      muteData.forEach(item => {
        mutes[item.channel_id] = { 
          is_muted: item.is_muted, 
          muted_until: item.muted_until 
        };
      });
      setMuteStates(mutes);

      const total = unreadData.reduce((acc: number, curr: any) => {
        const isMuted = mutes[curr.channel_id]?.is_muted && 
          (!mutes[curr.channel_id].muted_until || new Date(mutes[curr.channel_id].muted_until!) > new Date());
        
        if (isMuted) return acc;
        return acc + (curr.unread_count || 0);
      }, 0);

      setTotalUnreadCount(total);
    } catch (err) {
      // Silently handle errors
    }
  }, [supabase]);

  const playNotificationSound = useCallback(() => {
    if (!notificationPrefs?.sound_enabled) return;

    const now = Date.now();
    if (now - lastSoundPlayRef.current < 2000) return;

    lastSoundPlayRef.current = now;

    try {
      const audio = new Audio('/sounds/chat-notification.mp3');
      audio.volume = 0.4;
      audio.play().catch(e => {
        console.log('[Notification Sound] Playback blocked or asset missing:', e.message);
      });
    } catch (err) {
      // Audio API not supported
    }
  }, [notificationPrefs]);

  // PERSISTENCE: Hydrate
  useEffect(() => {
    if (typeof window === 'undefined' || !userProfile) return;

    try {
      const savedBubbles = localStorage.getItem(BUBBLE_STORAGE_KEY);
      if (savedBubbles) {
        const parsed = JSON.parse(savedBubbles);
        if (Array.isArray(parsed)) {
          setFloatingBubbles(parsed.filter(b => b && b.id));
        }
      }

      const savedPos = localStorage.getItem(POSITION_STORAGE_KEY);
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (parsed && typeof parsed.bottomOffset === 'number') {
          setStackPosition(parsed);
        }
      }
    } catch (err) {
      console.error("[FloatingChat] Persistence hydration failed:", err);
    } finally {
      isHydratedRef.current = true;
    }
  }, [userProfile]);

  // PERSISTENCE: Sync
  useEffect(() => {
    if (typeof window === 'undefined' || !userProfile || !isHydratedRef.current) return;
    localStorage.setItem(BUBBLE_STORAGE_KEY, JSON.stringify(floatingBubbles));
  }, [floatingBubbles, userProfile]);

  useEffect(() => {
    if (typeof window === 'undefined' || !userProfile || !isHydratedRef.current) return;
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(stackPosition));
  }, [stackPosition, userProfile]);

  // Presence
  useEffect(() => {
    if (!activeWorkspace || !userProfile) {
      setOnlineUsers({});
      return;
    }

    const channelId = `workspace-presence:${activeWorkspace.id}`;
    const channel = supabase.channel(channelId);

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const users: Record<string, PresenceUser> = {};
        
        Object.keys(newState).forEach((key) => {
          const userPresences = newState[key] as any[];
          userPresences.forEach((p) => {
            if (p.user_id) {
              users[p.user_id] = {
                user_id: p.user_id,
                full_name: p.full_name,
                avatar_url: p.avatar_url,
                avatar_preset: p.avatar_preset,
                online_at: p.online_at
              };
            }
          });
        });
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userProfile.id,
            full_name: userProfile.full_name,
            avatar_url: userProfile.avatar_url,
            avatar_preset: userProfile.avatar_preset,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [supabase, activeWorkspace, userProfile]);

  useEffect(() => {
    fetchUnreadData();
    fetchNotificationPrefs();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setTotalUnreadCount(0);
        setFloatingBubbles([]);
        setExpandedChannelId(null);
        setOnlineUsers({});
        setNotificationPrefs(null);
        setMuteStates({});
        if (typeof window !== 'undefined') {
          localStorage.removeItem(BUBBLE_STORAGE_KEY);
          localStorage.removeItem(POSITION_STORAGE_KEY);
        }
      } else {
        fetchUnreadData();
        fetchNotificationPrefs();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchUnreadData, fetchNotificationPrefs]);

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

  const updateStackPosition = useCallback((pos: StackPosition) => {
    setStackPosition(pos);
  }, []);

  return (
    <FloatingChatContext.Provider value={{
      floatingBubbles,
      expandedChannelId,
      totalUnreadCount,
      onlineUsers,
      notificationPrefs,
      muteStates,
      stackPosition,
      addBubble,
      removeBubble,
      toggleExpand,
      updateStackPosition,
      refreshUnread: fetchUnreadData,
      refreshNotificationPrefs: fetchNotificationPrefs,
      updateNotificationPrefs,
      playNotificationSound
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
