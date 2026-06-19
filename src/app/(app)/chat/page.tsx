"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Send, 
  Search, 
  Plus, 
  ChevronLeft, 
  Hash, 
  MoreVertical, 
  Paperclip, 
  Smile,
  MessageSquare,
  CheckCheck,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Chat {
  id: string;
  name: string;
  type: string;
  workspace_id: string;
  last_message?: string;
  last_message_at?: string;
}

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

function serializeSupabaseError(error: any) {
  if (!error) return null;
  return {
    name: error.name ?? null,
    message: error.message ?? "Unknown error",
    details: error.details ?? null,
    hint: error.hint ?? null,
    code: error.code ?? null,
    status: error.status ?? null,
    statusText: error.statusText ?? null,
    raw: String(error)
  };
}

export default function ChatPage() {
  const { activeWorkspace, userProfile } = useWorkspace();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const { toast } = useToast();

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const isAtBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return true;
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    return scrollHeight - scrollTop <= clientHeight + 100;
  };

  // Scroll on messages load or change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(loadingMessages ? "auto" : "smooth");
    }
  }, [messages, loadingMessages]);

  const fetchChats = useCallback(async () => {
    if (!activeWorkspace || !userProfile) return;
    
    setLoadingChats(true);
    setError(null);
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userProfile.id)
        .eq('status', 'active');

      if (memberError) throw new Error(`Unable to load membership: ${memberError.message}`);
      if (!memberData || memberData.length === 0) {
        setChats([]);
        return;
      }

      const workspaceIds = memberData.map(m => m.workspace_id);
      
      const { data: channelsData, error: channelsError } = await supabase
        .from('chat_channels')
        .select('id, workspace_id, sub_workspace_id, name, type, created_at')
        .in('workspace_id', workspaceIds)
        .order('created_at', { ascending: false });

      if (channelsError) throw new Error(`Unable to load channels: ${channelsError.message}`);

      if (!channelsData || channelsData.length === 0) {
        setChats([]);
        return;
      }

      const channelIds = channelsData.map(c => c.id);

      const { data: lastMessages } = await supabase
        .from('chat_messages')
        .select('id, channel_id, message, created_at')
        .in('channel_id', channelIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      const formattedChats: Chat[] = channelsData.map(channel => {
        const lastMsg = lastMessages?.find(m => m.channel_id === channel.id);
        return {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          workspace_id: channel.workspace_id,
          last_message: lastMsg?.message,
          last_message_at: lastMsg?.created_at
        };
      }).sort((a, b) => {
        const isAGeneral = a.name.toLowerCase() === 'general' && a.workspace_id === activeWorkspace.id;
        const isBGeneral = b.name.toLowerCase() === 'general' && b.workspace_id === activeWorkspace.id;
        if (isAGeneral) return -1;
        if (isBGeneral) return 1;
        const timeA = new Date(a.last_message_at || a.last_message_at || 0).getTime();
        const timeB = new Date(b.last_message_at || b.last_message_at || 0).getTime();
        return timeB - timeA;
      });

      setChats(formattedChats);
      
      // Auto-select first chat on desktop if none selected
      if (!selectedChatId && formattedChats.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
        setSelectedChatId(formattedChats[0].id);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while loading chats.");
    } finally {
      setLoadingChats(false);
    }
  }, [activeWorkspace, userProfile, supabase, selectedChatId]);

  const fetchMessages = useCallback(async (channelId: string) => {
    setLoadingMessages(true);
    try {
      const { data: msgData, error: msgError } = await supabase
        .from('chat_messages')
        .select('id, channel_id, workspace_id, sender_id, message, created_at, is_deleted')
        .eq('channel_id', channelId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (msgError) throw new Error(msgError.message);

      if (!msgData || msgData.length === 0) {
        setMessages([]);
        setLoadingMessages(false);
        return;
      }

      const senderIds = Array.from(new Set(msgData.map(m => m.sender_id)));
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, avatar_preset')
        .in('id', senderIds);

      const enrichedMessages: Message[] = msgData.map(m => ({
        ...m,
        profiles: profilesData?.find(p => p.id === m.sender_id) || null
      }));

      setMessages(enrichedMessages);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Sync Error", description: err.message });
    } finally {
      setLoadingMessages(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    if (selectedChatId) {
      fetchMessages(selectedChatId);
    } else {
      setMessages([]);
    }
  }, [selectedChatId, fetchMessages]);

  // Realtime Subscription
  useEffect(() => {
    if (!selectedChatId) return;

    const channel = supabase
      .channel(`chat_messages:${selectedChatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${selectedChatId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          const wasAtBottom = isAtBottom();

          setMessages((prev) => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, { ...newMessage, profiles: null }];
          });

          // Fetch sender profile
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url, avatar_preset')
              .eq('id', newMessage.sender_id)
              .single();
            
            setMessages((prev) => 
              prev.map(m => m.id === newMessage.id ? { ...m, profiles: profileData || null } : m)
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            );

            // Auto-scroll if user is already at bottom or it's their own message
            if (wasAtBottom || newMessage.sender_id === userProfile?.id) {
              setTimeout(() => scrollToBottom(), 100);
            }
          } catch (err) {
            console.error("Profile sync error:", err);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${selectedChatId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as any;
          if (updatedMessage.is_deleted) {
            setMessages((prev) => prev.filter(m => m.id !== updatedMessage.id));
          } else {
            setMessages((prev) => prev.map(m => m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChatId, supabase, userProfile?.id]);

  const handleSelectChat = (id: string) => {
    setSelectedChatId(id);
    setShowConversation(true);
  };

  const selectedChat = chats.find(c => c.id === selectedChatId);
  const isGeneral = selectedChat?.name?.toLowerCase() === 'general';
  
  const handleSendMessage = async () => {
    const text = messageInput.trim();
    if (!selectedChat || !userProfile || isGeneral || !text || isSending) return;

    setIsSending(true);
    try {
      const { error: sendError } = await supabase
        .from('chat_messages')
        .insert({
          channel_id: selectedChat.id,
          workspace_id: selectedChat.workspace_id,
          sender_id: userProfile.id,
          message: text
        });

      if (sendError) throw sendError;
      setMessageInput("");
      // Realtime listener handles append
    } catch (err: any) {
      toast({ variant: "destructive", title: "Send Failed", description: "Your message could not be delivered." });
    } finally {
      setIsSending(false);
    }
  };

  const filteredChats = chats.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] flex overflow-hidden bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] shadow-2xl animate-in fade-in duration-500">
      
      {/* Sidebar */}
      <div className={cn(
        "w-full md:w-[350px] border-r dark:border-slate-800 flex flex-col shrink-0 transition-all",
        showConversation ? "hidden md:flex" : "flex"
      )}>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Chat</h1>
            <Button size="icon" variant="ghost" className="rounded-xl text-primary hover:bg-primary/5">
              <Plus className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search chats" 
              className="pl-10 h-11 bg-slate-100 dark:bg-slate-800 border-none rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1 pb-6">
            {loadingChats ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-xs font-medium">Syncing channels...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-rose-500 gap-2">
                <AlertCircle className="w-8 h-8 opacity-50" />
                <p className="text-sm font-bold">Failed to load</p>
                <Button variant="outline" size="sm" onClick={fetchChats} className="mt-4 h-8 text-[10px] uppercase font-bold tracking-wider">Retry</Button>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="text-center py-10 opacity-50">
                <p className="text-sm font-medium">No channels found</p>
              </div>
            ) : (
              filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => handleSelectChat(chat.id)}
                  className={cn(
                    "w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all group hover:bg-slate-50 dark:hover:bg-slate-800/50",
                    selectedChatId === chat.id ? "bg-primary/10 dark:bg-primary/10" : ""
                  )}
                >
                  <Avatar className="w-12 h-12 border-2 border-white dark:border-slate-800 shadow-sm shrink-0">
                    <AvatarFallback className={cn(
                      "bg-primary/10 text-primary font-bold",
                      selectedChatId === chat.id ? "bg-primary text-white" : ""
                    )}>
                      {chat.name.toLowerCase() === 'general' ? <Hash className="w-5 h-5" /> : chat.name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <p className={cn(
                        "font-bold text-sm truncate",
                        selectedChatId === chat.id ? "text-primary" : "text-slate-900 dark:text-white"
                      )}>{chat.name}</p>
                      {chat.last_message_at && (
                        <span className="text-[10px] text-slate-400 font-medium ml-2 shrink-0">
                          {new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {chat.last_message || (chat.name.toLowerCase() === 'general' ? 'Workspace Channel' : chat.type === 'group' ? 'Group Chat' : 'Public Channel')}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Conversation Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-slate-50/30 dark:bg-slate-950/20 transition-all",
        !showConversation ? "hidden md:flex" : "flex"
      )}>
        {selectedChat ? (
          <>
            {/* Header */}
            <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden rounded-xl h-10 w-10" 
                  onClick={() => setShowConversation(false)}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Avatar className="w-10 h-10 border-2 border-white dark:border-slate-800 shadow-sm">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {selectedChat.name.toLowerCase() === 'general' ? <Hash className="w-4 h-4" /> : selectedChat.name[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-bold text-sm md:text-base dark:text-white truncate">{selectedChat.name}</p>
                  <p className="text-[10px] md:text-xs text-emerald-500 font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    {selectedChat.name.toLowerCase() === 'general' ? 'Workspace Channel' : selectedChat.type === 'group' ? 'Group Chat' : 'Direct Message'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="rounded-xl text-slate-400"><Search className="w-5 h-5" /></Button>
                <Button variant="ghost" size="icon" className="rounded-xl text-slate-400"><MoreVertical className="w-5 h-5" /></Button>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 md:px-8">
              <div className="py-8 space-y-6">
                {loadingMessages ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm font-medium">History is loading...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                    <MessageSquare className="w-12 h-12 mb-4 text-slate-300" />
                    <p className="font-bold text-lg">No messages here yet</p>
                    <p className="text-sm">Be the first to say hello!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === userProfile?.id;
                    const avatarSrc = msg.profiles?.avatar_preset ? `/avatars/${msg.profiles.avatar_preset}.png` : msg.profiles?.avatar_url;
                    
                    return (
                      <div key={msg.id} className={cn(
                        "flex gap-3 max-w-[85%] md:max-w-[70%]",
                        isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                      )}>
                        {!isMe && (
                          <Avatar className="w-8 h-8 shrink-0 shadow-sm mt-1">
                            <AvatarImage src={avatarSrc} />
                            <AvatarFallback className="text-[10px] bg-slate-100 font-bold">{msg.profiles?.full_name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                          {!isMe && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1 ml-1">{msg.profiles?.full_name}</span>}
                          <div className={cn(
                            "px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed relative group",
                            isMe 
                              ? "bg-primary text-white rounded-tr-none" 
                              : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border dark:border-slate-700"
                          )}>
                            {msg.message}
                            <div className={cn(
                              "flex items-center gap-1.5 mt-1.5 justify-end opacity-70 text-[9px] font-bold",
                              isMe ? "text-white/80" : "text-slate-400"
                            )}>
                              <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {isMe && <CheckCheck className="w-3 h-3" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Bar */}
            <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t dark:border-slate-800">
              <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-950 p-2 rounded-2xl border dark:border-slate-800 transition-all focus-within:ring-2 focus-within:ring-primary/20">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary rounded-xl shrink-0" disabled={isGeneral}>
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Input 
                  className="border-none shadow-none bg-transparent focus-visible:ring-0 text-base flex-1 dark:text-white" 
                  placeholder={isGeneral ? "General Chat is read-only." : "Type a message..."}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  disabled={loadingMessages || isSending || isGeneral}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary rounded-xl shrink-0 hidden sm:flex" disabled={isGeneral}>
                  <Smile className="w-5 h-5" />
                </Button>
                <Button 
                  size="icon" 
                  onClick={handleSendMessage}
                  className={cn(
                    "rounded-xl shadow-lg transition-all active:scale-95 shrink-0",
                    messageInput.trim() && !loadingMessages && !isSending && !isGeneral ? "bg-primary" : "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
                  )}
                  disabled={!messageInput.trim() || loadingMessages || isSending || isGeneral}
                >
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </div>
              {isGeneral && <p className="text-[10px] text-center mt-2 text-slate-400 font-bold uppercase tracking-widest">Public channel restricted to viewing</p>}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-2">
              <MessageSquare className="w-10 h-10 text-primary/40" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Workspace Messenger</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1">
                Select a conversation to start collaborating with your team members.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
