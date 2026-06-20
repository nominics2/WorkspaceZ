"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Send, X, Minus, Loader2, BellOff, MoreVertical, Copy, Edit2, Trash2, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { cn } from "@/lib/utils";
import { Chat, useFloatingChat } from "./FloatingChatProvider";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
    avatar_preset: string;
  } | null;
}

export function FloatingChatWindow({ 
  chat, 
  onMinimize, 
  onClose,
  isMuted
}: { 
  chat: Chat; 
  onMinimize: () => void; 
  onClose: () => void;
  isMuted?: boolean;
}) {
  const { userProfile } = useWorkspace();
  const { refreshUnread } = useFloatingChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, channel_id, workspace_id, sender_id, message, created_at, is_deleted')
        .eq('channel_id', chat.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const senderIds = Array.from(new Set(data?.map(m => m.sender_id) || []));
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, avatar_preset')
        .in('id', senderIds);

      const enriched = (data || []).map(m => ({
        ...m,
        profiles: profilesData?.find(p => p.id === m.sender_id) || null
      }));

      setMessages(enriched);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
    } catch (err) {
      console.error("[Floating Chat] Load Failed:", err);
    } finally {
      setLoading(false);
    }
  }, [chat.id, supabase]);

  const markRead = useCallback(async () => {
    try {
      await supabase.rpc("mark_chat_channel_read", { p_channel_id: chat.id });
      refreshUnread();
    } catch (err) {
      // Background operation failure handled silently
    }
  }, [chat.id, supabase, refreshUnread]);

  useEffect(() => {
    fetchMessages();
    markRead();
  }, [fetchMessages, markRead]);

  useEffect(() => {
    const channel = supabase
      .channel(`floating_chat:${chat.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${chat.id}` }, async (payload) => {
        const newMessage = payload.new as any;
        
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, { ...newMessage, profiles: null }];
        });

        markRead();

        try {
          const { data: profile } = await supabase.from('profiles').select('id, full_name, avatar_url, avatar_preset').eq('id', newMessage.sender_id).single();
          setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, profiles: profile } : m));
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        } catch (err) {}
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chat.id, supabase, markRead]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending || !userProfile) return;

    setIsSending(true);
    try {
      const { error } = await supabase.from('chat_messages').insert({
        channel_id: chat.id,
        workspace_id: chat.workspace_id,
        sender_id: userProfile.id,
        message: text
      });
      if (error) throw error;
      setInput("");
    } catch (err) {
      console.error("[Floating Chat] Transmission Error:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyMessage = (text: string) => {
    if (!text || text.trim().length === 0) return;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Message copied" });
    }).catch((err) => {
      console.error("[Floating Chat] Clipboard Error:", err);
      toast({ variant: "destructive", title: "Unable to copy message" });
    });
  };

  return (
    <div className="w-[calc(100vw-2rem)] sm:w-[350px] h-[450px] sm:h-[500px] bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 pointer-events-auto">
      <div className="p-4 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="w-8 h-8">
            <AvatarImage src={chat.display_avatar_preset ? `/avatars/${chat.display_avatar_preset}.png` : chat.display_avatar} />
            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
              {chat.display_name?.[0]?.toUpperCase() || 'C'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate dark:text-white flex items-center gap-1.5">
              {chat.display_name}
              {isMuted && <BellOff className="w-3 h-3 text-slate-400" />}
            </p>
            <p className="text-[10px] text-emerald-500 font-medium">Ready</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Minimize" className="h-8 w-8 rounded-lg" onClick={onMinimize}>
            <Minus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Close" className="h-8 w-8 rounded-lg text-rose-500" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 p-4 bg-slate-50/30 dark:bg-slate-950/10">
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : messages.length === 0 ? (
            <p className="text-[10px] text-center text-slate-400 py-10">Empty conversation</p>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === userProfile?.id;
              return (
                <div key={msg.id} className={cn("group flex flex-col max-w-[85%] relative", isMe ? "ml-auto items-end" : "items-start")}>
                  {!isMe && <span className="text-[9px] font-bold text-slate-400 mb-1 ml-1">{msg.profiles?.full_name}</span>}
                  <div className={cn(
                    "px-3 py-2 rounded-xl text-xs shadow-sm relative",
                    isMe ? "bg-primary text-white rounded-tr-none" : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border dark:border-slate-700"
                  )}>
                    {msg.message}

                    {/* Action Menu */}
                    <div className={cn(
                      "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity",
                      isMe ? "-left-8" : "-right-8"
                    )}>
                      <DropdownMenu onOpenChange={(open) => !open && (typeof document !== 'undefined' ? document.body.style.pointerEvents = "" : null)}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full dark:text-slate-400">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isMe ? "end" : "start"} className="w-40 dark:bg-slate-900 dark:border-slate-800">
                           <DropdownMenuItem 
                             onClick={() => handleCopyMessage(msg.message)}
                             disabled={!msg.message || msg.message.trim().length === 0}
                             className="text-xs gap-2"
                           >
                             <Copy className="h-3 w-3" /> Copy
                           </DropdownMenuItem>
                           <DropdownMenuSeparator className="dark:bg-slate-800" />
                           <DropdownMenuItem disabled className="text-xs gap-2"><Edit2 className="h-3 w-3" /> Edit</DropdownMenuItem>
                           <DropdownMenuItem disabled className="text-xs gap-2 text-rose-500"><Trash2 className="h-3 w-3" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="p-3 border-t dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border dark:border-slate-800">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type..."
            className="border-none shadow-none focus-visible:ring-0 h-8 text-xs bg-transparent dark:text-white"
          />
          <Button size="icon" aria-label="Send" onClick={handleSend} disabled={!input.trim() || isSending} className="h-7 w-7 rounded-lg shrink-0">
            {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
