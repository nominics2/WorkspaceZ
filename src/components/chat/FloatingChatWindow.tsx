"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { 
  Send, 
  X, 
  Minus, 
  Loader2, 
  BellOff, 
  MoreVertical, 
  Copy, 
  Edit2, 
  Trash2, 
  CheckSquare, 
  Check,
  ExternalLink,
  AlertTriangle,
  Reply
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  updated_at?: string;
  created_task_id?: string | null;
  reply_to_message_id?: string | null;
  is_deleted?: boolean;
  profiles?: {
    full_name: string;
    avatar_url: string;
    avatar_preset: string;
  } | null;
  tasks?: {
    is_deleted: boolean;
  } | null;
  reply_to?: Message | null;
}

interface TypingUser {
  id: string;
  full_name: string;
  lastSeen: number;
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
  const { userProfile, userRole } = useWorkspace();
  const { refreshUnread, onlineUsers } = useFloatingChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);

  // Typing State
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser>>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBroadcastRef = useRef<number>(0);
  const typingChannelRef = useRef<any>(null);

  // Message Actions state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isEditingLoading, setIsEditingLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [messageIdToDelete, setMessageIdToDelete] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);

  const isAdminOrSuper = userRole === 'superadmin' || userRole === 'admin' || userRole === 'manager';

  /**
   * TYPING LOGIC
   */
  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (!typingChannelRef.current || !userProfile) return;

    const now = Date.now();
    if (isTyping && now - lastBroadcastRef.current < 2000) return;

    if (isTyping) lastBroadcastRef.current = now;

    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        id: userProfile.id,
        full_name: userProfile.full_name,
        is_typing: isTyping,
        timestamp: now
      }
    });
  }, [userProfile]);

  useEffect(() => {
    if (!chat.id || !userProfile) return;

    setTypingUsers({});
    const channel = supabase.channel(`chat-typing:${chat.id}`);
    typingChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.id === userProfile.id) return;
        setTypingUsers(prev => {
          const next = { ...prev };
          if (payload.is_typing) {
            next[payload.id] = { id: payload.id, full_name: payload.full_name, lastSeen: Date.now() };
          } else {
            delete next[payload.id];
          }
          return next;
        });
      })
      .subscribe();

    const interval = setInterval(() => {
      setTypingUsers(prev => {
        const now = Date.now();
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(uid => {
          if (now - next[uid].lastSeen > 5000) {
            delete next[uid];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 2000);

    return () => {
      sendTypingStatus(false);
      supabase.removeChannel(channel);
      clearInterval(interval);
      typingChannelRef.current = null;
    };
  }, [chat.id, userProfile, supabase, sendTypingStatus]);

  const handleInputChange = (val: string) => {
    setInput(val);
    if (val.trim().length > 0) {
      sendTypingStatus(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => sendTypingStatus(false), 3000);
    } else {
      sendTypingStatus(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const typingText = useMemo(() => {
    const list = Object.values(typingUsers);
    if (list.length === 0) return null;
    if (list.length === 1) return `${list[0].full_name} is typing...`;
    if (list.length === 2) return `${list[0].full_name} and ${list[1].full_name} are typing...`;
    return "Several people are typing...";
  }, [typingUsers]);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, channel_id, workspace_id, sender_id, message, created_at, updated_at, is_deleted, created_task_id, reply_to_message_id, tasks(is_deleted)')
        .eq('channel_id', chat.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const senderIds = Array.from(new Set(data?.map(m => m.sender_id) || []));
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, avatar_preset')
        .in('id', senderIds);

      // Enrichment: Load missing original messages for replies
      const missingReplyIds = Array.from(new Set(
        (data || [])
          .map(m => m.reply_to_message_id)
          .filter((id): id is string => !!id && !data?.some(existing => existing.id === id))
      ));

      let extraMessages: Message[] = [];
      if (missingReplyIds.length > 0) {
        const { data: extras } = await supabase
          .from('chat_messages')
          .select('id, sender_id, message, created_at, is_deleted, profiles(full_name, avatar_url, avatar_preset)')
          .in('id', missingReplyIds);
        
        if (extras) {
          extraMessages = (extras as any[]).map(e => ({
            ...e,
            profiles: e.profiles
          }));
        }
      }

      const allLookupMap = [...(data || []).map(m => ({ ...m, profiles: profilesData?.find(p => p.id === m.sender_id) || null })), ...extraMessages];

      const enriched = (data || []).map(m => ({
        ...m,
        profiles: profilesData?.find(p => p.id === m.sender_id) || null,
        reply_to: m.reply_to_message_id ? allLookupMap.find(am => am.id === m.reply_to_message_id) : null
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
          return [...prev, { ...newMessage, profiles: null, reply_to: null }];
        });

        markRead();

        // Refetch metadata for replies
        setTimeout(() => fetchMessages(), 1000);

        try {
          const { data: profile } = await supabase.from('profiles').select('id, full_name, avatar_url, avatar_preset').eq('id', newMessage.sender_id).single();
          setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, profiles: profile } : m));
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        } catch (err) {}
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${chat.id}` }, (payload) => {
        const updated = payload.new as any;
        if (updated.is_deleted) {
          setMessages(prev => prev.filter(m => m.id !== updated.id));
        } else {
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chat.id, supabase, markRead, fetchMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending || !userProfile) return;

    setIsSending(true);
    sendTypingStatus(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    try {
      const { error } = await supabase.from('chat_messages').insert({
        channel_id: chat.id,
        workspace_id: chat.workspace_id,
        sender_id: userProfile.id,
        message: text,
        reply_to_message_id: replyingToMessage?.id || null
      });
      if (error) throw error;
      setInput("");
      setReplyingToMessage(null);
    } catch (err) {
      console.error("[Floating Chat] Transmission Error:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleUpdateMessage = async () => {
    const text = editValue.trim();
    if (!editingMessageId || !text || isEditingLoading) return;
    
    const original = messages.find(m => m.id === editingMessageId);
    if (original?.message === text) {
      setEditingMessageId(null);
      return;
    }

    setIsEditingLoading(true);
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({
          message: text,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingMessageId)
        .eq('sender_id', userProfile?.id);

      if (error) throw error;
      setEditingMessageId(null);
      setEditValue("");
      toast({ title: "Updated" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    } finally {
      setIsEditingLoading(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!messageIdToDelete || !userProfile) return;

    try {
      const { error } = await supabase.rpc("soft_delete_chat_message", {
        p_message_id: messageIdToDelete
      });

      if (error) throw error;

      setMessages(prev => prev.filter(m => m.id !== messageIdToDelete));
      toast({ title: "Deleted" });
    } catch (err: any) {
      console.error("[Floating Chat] Delete Error:", err);
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsDeleteDialogOpen(false);
      setMessageIdToDelete(null);
    }
  };

  const handleCopyMessage = (text: string) => {
    if (!text || text.trim().length === 0) return;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied" });
    }).catch((err) => {
      console.error("[Floating Chat] Clipboard Error:", err);
      toast({ variant: "destructive", title: "Unable to copy" });
    });
  };

  const handleJumpToMessage = (msgId: string) => {
    const element = document.getElementById(`floating-message-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Logic for temporary highlighting can be added here if needed
    }
  };

  const isUserOnline = useMemo(() => {
    if (chat.type !== 'direct' || !chat.other_user_id) return false;
    return !!onlineUsers[chat.other_user_id];
  }, [chat, onlineUsers]);

  return (
    <div className="w-[calc(100vw-2rem)] sm:w-[350px] h-[450px] sm:h-[500px] bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 pointer-events-auto">
      <div className="p-4 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <Avatar className="w-8 h-8">
              <AvatarImage src={chat.display_avatar_preset ? `/avatars/${chat.display_avatar_preset}.png` : chat.display_avatar} />
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                {chat.display_name?.[0]?.toUpperCase() || 'C'}
              </AvatarFallback>
            </Avatar>
            {isUserOnline && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate dark:text-white flex items-center gap-1.5">
              {chat.display_name}
              {isMuted && <BellOff className="w-3 h-3 text-slate-400" />}
            </p>
            <p className={cn("text-[10px] font-medium", isUserOnline ? "text-emerald-500" : "text-slate-400")}>
              {chat.type === 'direct' ? (isUserOnline ? "Online" : "Offline") : "Ready"}
            </p>
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

      <ScrollArea className="flex-1 p-4 bg-slate-50/30 dark:bg-slate-950/10">
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : messages.length === 0 ? (
            <p className="text-[10px] text-center text-slate-400 py-10">Empty conversation</p>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === userProfile?.id;
              const isEditing = editingMessageId === msg.id;
              const wasEdited = msg.updated_at && new Date(msg.updated_at).getTime() - new Date(msg.created_at).getTime() > 1000;
              
              const canDelete = isMe || isAdminOrSuper;

              const isTaskDeleted = msg.tasks?.is_deleted;
              const isTaskUnavailable = msg.created_task_id && !msg.tasks;

              return (
                <div key={msg.id} id={`floating-message-${msg.id}`} className={cn("group flex flex-col max-w-[85%] relative", isMe ? "ml-auto items-end" : "items-start", isEditing && "w-full")}>
                  {!isMe && <span className="text-[9px] font-bold text-slate-400 mb-1 ml-1">{msg.profiles?.full_name}</span>}
                  
                  {isEditing ? (
                    <div className="w-full bg-slate-100 dark:bg-slate-800 p-2 rounded-xl border space-y-2">
                       <Textarea 
                         value={editValue}
                         onChange={e => setEditValue(e.target.value)}
                         className="min-h-[60px] text-xs bg-white dark:bg-slate-950 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/40"
                         autoFocus
                         onKeyDown={e => {
                           if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleUpdateMessage(); }
                           if (e.key === 'Escape') setEditingMessageId(null);
                         }}
                       />
                       <div className="flex justify-end gap-1">
                         <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingMessageId(null)} disabled={isEditingLoading}><X className="h-3 w-3" /></Button>
                         <Button size="icon" className="h-6 w-6" onClick={handleUpdateMessage} disabled={isEditingLoading || !editValue.trim()}>
                           {isEditingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                         </Button>
                       </div>
                    </div>
                  ) : (
                    <div className={cn(
                      "px-3 py-2 rounded-xl text-xs shadow-sm relative",
                      isMe ? "bg-primary text-white rounded-tr-none" : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border dark:border-slate-700"
                    )}>
                      {/* Reply Preview inside Bubble */}
                      {msg.reply_to && (
                        <div 
                          onClick={() => handleJumpToMessage(msg.reply_to!.id)}
                          className={cn(
                            "mb-1.5 p-1.5 rounded-lg border-l-2 cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-[10px]",
                            isMe ? "bg-white/10 border-white/40 text-white/90" : "bg-slate-50 dark:bg-slate-950/50 border-primary/40 text-slate-500 dark:text-slate-400"
                          )}
                        >
                          <p className="font-bold mb-0.5 truncate">{msg.reply_to.profiles?.full_name || "User"}</p>
                          <p className="line-clamp-1 italic text-[9px]">
                            {msg.reply_to.is_deleted ? "Message deleted" : (msg.reply_to.message || "Attachment")}
                          </p>
                        </div>
                      )}

                      {msg.message}

                      {/* Task Chip */}
                      {msg.created_task_id && (
                        <div className="mt-2 pt-1 border-t border-white/20 dark:border-slate-700">
                          <button 
                            disabled={isTaskDeleted || isTaskUnavailable}
                            onClick={() => router.push(`/tasks?taskId=${msg.created_task_id}`)}
                            className={cn(
                              "flex items-center gap-1 text-[8px] font-bold uppercase hover:opacity-80 transition-opacity",
                              isMe ? "text-white" : "text-primary",
                              (isTaskDeleted || isTaskUnavailable) && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {isTaskDeleted ? (
                              <><X className="h-2 w-2" /> Deleted</>
                            ) : isTaskUnavailable ? (
                              <><AlertTriangle className="h-2 w-2" /> Unavailable</>
                            ) : (
                              <><CheckSquare className="h-2 w-2" /> Linked Task</>
                            )}
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 mt-1 justify-end opacity-70 text-[8px] font-bold">
                        {wasEdited && <span className="italic mr-0.5">(edited)</span>}
                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {/* Action Menu */}
                      {!isEditing && (
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
                               <DropdownMenuItem onClick={() => setReplyingToMessage(msg)} className="text-xs gap-2">
                                 <Reply className="h-3 w-3" /> Reply
                               </DropdownMenuItem>
                               <DropdownMenuItem 
                                 onClick={() => handleCopyMessage(msg.message)}
                                 disabled={!msg.message || msg.message.trim().length === 0}
                                 className="text-xs gap-2"
                               >
                                 <Copy className="h-3 w-3" /> Copy
                               </DropdownMenuItem>
                               {isMe && msg.message && (
                                 <DropdownMenuItem 
                                   onClick={() => { setEditingMessageId(msg.id); setEditValue(msg.message); }}
                                   className="text-xs gap-2"
                                 >
                                   <Edit2 className="h-3 w-3" /> Edit
                                 </DropdownMenuItem>
                               )}
                               {canDelete && (
                                 <DropdownMenuItem 
                                   onClick={() => { setMessageIdToDelete(msg.id); setIsDeleteDialogOpen(true); }}
                                   className="text-xs gap-2 text-rose-500"
                                 >
                                   <Trash2 className="h-3 w-3" /> Delete
                                 </DropdownMenuItem>
                               )}
                               <DropdownMenuSeparator className="dark:bg-slate-800" />
                               {msg.created_task_id ? (
                                 <DropdownMenuItem 
                                   disabled={isTaskDeleted || isTaskUnavailable}
                                   onClick={() => router.push(`/tasks?taskId=${msg.created_task_id}`)}
                                   className="text-xs gap-2"
                                 >
                                   <ExternalLink className="h-3 w-3" /> View Task
                                 </DropdownMenuItem>
                               ) : (
                                 <DropdownMenuItem disabled className="text-xs gap-2">
                                   <CheckSquare className="h-3 w-3" /> Create Task
                                 </DropdownMenuItem>
                               )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="p-3 border-t dark:border-slate-800 bg-white dark:bg-slate-900 relative">
        {/* Typing Indicator */}
        {typingText && (
          <div className="absolute bottom-full left-0 right-0 px-4 py-1 animate-in fade-in slide-in-from-bottom-1 duration-200 pointer-events-none">
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                <span className="w-0.5 h-0.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-0.5 h-0.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-0.5 h-0.5 bg-primary rounded-full animate-bounce" />
              </div>
              <span className="text-[8px] font-medium text-slate-500 italic truncate">
                {typingText}
              </span>
            </div>
          </div>
        )}

        {/* Reply Preview Bar */}
        {replyingToMessage && (
          <div className="absolute bottom-full left-0 right-0 bg-slate-50 dark:bg-slate-950 border-t dark:border-slate-800 p-2 animate-in slide-in-from-bottom-2 duration-200">
             <div className="flex items-center justify-between gap-2 px-2">
                <div className="flex items-center gap-2 overflow-hidden">
                   <div className="w-0.5 h-6 bg-primary rounded-full shrink-0" />
                   <div className="min-w-0">
                      <p className="text-[9px] font-bold text-primary truncate">Replying to {replyingToMessage.profiles?.full_name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{replyingToMessage.message || "Attachment"}</p>
                   </div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setReplyingToMessage(null)}>
                  <X className="w-3 h-3" />
                </Button>
             </div>
          </div>
        )}

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border dark:border-slate-800">
          <Input 
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type..."
            className="border-none shadow-none focus-visible:ring-0 h-8 text-xs bg-transparent dark:text-white"
          />
          <Button size="icon" aria-label="Send" onClick={handleSend} disabled={!input.trim() || isSending} className="h-7 w-7 rounded-lg shrink-0">
            {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => !open && setIsDeleteDialogOpen(false)}>
        <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800 p-6 rounded-2xl w-[90vw] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">Delete message?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500">
              This message will be removed for everyone in this chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4">
            <AlertDialogCancel className="flex-1 h-9 text-xs rounded-xl mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteMessage} 
              className="flex-1 h-9 text-xs rounded-xl bg-rose-500 hover:bg-rose-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
