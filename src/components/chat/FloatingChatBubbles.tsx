"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Hash, Users, MessageCircle, BellOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useFloatingChat, Chat } from "./FloatingChatProvider";
import { FloatingChatWindow } from "./FloatingChatWindow";

const BUBBLE_COLORS = [
  'ring-blue-500 bg-blue-500',
  'ring-indigo-500 bg-indigo-500',
  'ring-violet-500 bg-violet-500',
  'ring-purple-500 bg-purple-500',
  'ring-fuchsia-500 bg-fuchsia-500',
  'ring-pink-500 bg-pink-500',
  'ring-rose-500 bg-rose-500',
  'ring-orange-500 bg-orange-500',
  'ring-amber-500 bg-amber-500',
  'ring-emerald-500 bg-emerald-500',
  'ring-teal-500 bg-teal-500',
  'ring-cyan-500 bg-cyan-500',
  'ring-sky-500 bg-sky-500'
];

const getChannelBubbleColor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BUBBLE_COLORS[Math.abs(hash) % BUBBLE_COLORS.length];
};

export function FloatingChatBubbles() {
  const { floatingBubbles, expandedChannelId, toggleExpand, removeBubble } = useFloatingChat();
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [muteStates, setMuteStates] = useState<Record<string, boolean>>({});
  const supabase = createClient();

  const fetchStates = useCallback(async () => {
    try {
      const { data: unreads } = await supabase.rpc("get_chat_unread_counts");
      const { data: mutes } = await supabase.rpc("get_chat_mute_states");
      
      const uMap: Record<string, number> = {};
      unreads?.forEach((u: any) => uMap[u.channel_id] = u.unread_count);
      setUnreadCounts(uMap);

      const mMap: Record<string, boolean> = {};
      mutes?.forEach((m: any) => {
        const isMuted = m.is_muted && (!m.muted_until || new Date(m.muted_until) > new Date());
        mMap[m.channel_id] = isMuted;
      });
      setMuteStates(mMap);
    } catch (err) {
      console.error(err);
    }
  }, [supabase]);

  useEffect(() => {
    fetchStates();
    const interval = setInterval(fetchStates, 30000); // Periodically sync unreads
    return () => clearInterval(interval);
  }, [fetchStates]);

  if (floatingBubbles.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-[100] pointer-events-none">
      {floatingBubbles.map((chat) => {
        const isExpanded = expandedChannelId === chat.id;
        const unreadCount = unreadCounts[chat.id] || 0;
        const isMuted = muteStates[chat.id];
        const bubbleColor = getChannelBubbleColor(chat.id);
        const avatarSrc = chat.display_avatar_preset ? `/avatars/${chat.display_avatar_preset}.png` : chat.display_avatar;

        return (
          <div key={`floating-${chat.id}`} className="flex flex-col items-end gap-3 pointer-events-auto">
            {isExpanded && (
              <FloatingChatWindow 
                chat={chat} 
                onMinimize={() => toggleExpand(null)}
                onClose={() => removeBubble(chat.id)}
                isMuted={isMuted}
              />
            )}
            {!isExpanded && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => toggleExpand(chat.id)}
                      className={cn(
                        "w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 group relative ring-2 ring-offset-2 dark:ring-offset-slate-900",
                        bubbleColor.split(' ')[0]
                      )}
                    >
                      <Avatar className="w-full h-full border-none">
                        <AvatarImage src={avatarSrc} />
                        <AvatarFallback className={cn("text-white font-bold", bubbleColor.split(' ')[1])}>
                          {chat.name.toLowerCase() === 'general' ? <Hash className="w-6 h-6" /> : 
                           chat.type === 'group' ? <Users className="w-6 h-6" /> :
                           (chat.display_name?.[0] || 'C').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      {unreadCount > 0 && (
                        <Badge className={cn(
                          "absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-slate-900 rounded-full",
                          isMuted ? "bg-slate-400" : "bg-primary"
                        )}>
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </Badge>
                      )}
                      
                      {isMuted && (
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-1 shadow-sm">
                          <BellOff className="w-3 h-3 text-slate-400" />
                        </div>
                      )}

                      <div className="absolute -left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-full pr-4 pointer-events-none">
                        <Badge variant="secondary" className="whitespace-nowrap bg-white dark:bg-slate-800 shadow-xl border dark:border-slate-700 py-1 px-3 text-xs font-bold">
                          {chat.display_name}
                        </Badge>
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">{chat.display_name}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        );
      })}
    </div>
  );
}
