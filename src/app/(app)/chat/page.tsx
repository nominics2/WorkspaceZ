"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Chat {
  id: string;
  name: string;
  type: string;
  last_message?: string;
  last_message_at?: string;
  workspace_id: string;
}

interface Message {
  id: string;
  chat_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string;
    avatar_preset: string;
  } | null;
}

/**
 * Serializes a Supabase error into a readable object.
 */
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
    raw: String(error),
    ownProperties: Object.getOwnPropertyNames(error).reduce((acc: any, key) => {
      acc[key] = error[key];
      return acc;
    }, {}),
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
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const { toast } = useToast();

  const fetchChats = useCallback(async () => {
    if (!activeWorkspace || !userProfile) {
      console.log("[Chat Debug] Missing workspace or profile, skipping fetch.");
      return;
    }
    
    setLoadingChats(true);
    setError(null);
    try {
      console.log("[Chat Debug] Running Diagnostic Test Query...");
      
      // DIAGNOSTIC TEST: Can we see ANY memberships?
      const { data: testData, error: testError } = await supabase
        .from('chat_members')
        .select('*')
        .limit(1);

      if (testError) {
        const serialized = serializeSupabaseError(testError);
        console.error("[Chat Debug] DIAGNOSTIC TEST FAILED:", serialized);
        throw new Error(`Database Access Denied (Code: ${serialized?.code}). Check RLS policies for chat_members.`);
      }
      
      console.log("[Chat Debug] DIAGNOSTIC TEST PASSED. Table is readable.");

      // STEP 1: Get memberships for this user
      // Column 'user_id' is assumed standard based on workspace_members schema.
      const { data: membershipData, error: membershipError } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', userProfile.id);

      if (membershipError) {
        const serialized = serializeSupabaseError(membershipError);
        console.error("[Chat Debug] Fetch Membership Error:", serialized);
        throw new Error(`Unable to fetch your chat memberships (Code: ${serialized?.code})`);
      }

      console.log("[Chat Debug] Found memberships:", membershipData?.length || 0);

      if (!membershipData || membershipData.length === 0) {
        setChats([]);
        return;
      }

      const chatIds = membershipData.map(m => m.chat_id);

      // STEP 2: Get chat details for those IDs in the active workspace
      const { data: chatsData, error: chatsError } = await supabase
        .from('chats')
        .select('id, name, type, workspace_id')
        .in('id', chatIds)
        .eq('workspace_id', activeWorkspace.id);

      if (chatsError) {
        const serialized = serializeSupabaseError(chatsError);
        console.error("[Chat Debug] Fetch Chats Detail Error:", serialized);
        throw new Error(`Unable to fetch chat details (Code: ${serialized?.code})`);
      }

      setChats(chatsData || []);
    } catch (err: any) {
      console.error("[Chat Debug] Final Error Catch:", err);
      setError(err.message || "An unexpected error occurred while loading chats.");
    } finally {
      setLoadingChats(false);
    }
  }, [activeWorkspace, userProfile, supabase]);

  const fetchMessages = useCallback(async (chatId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error: msgError } = await supabase
        .from('messages')
        .select(`
          id,
          chat_id,
          user_id,
          content,
          created_at,
          profiles:user_id (
            full_name,
            avatar_url,
            avatar_preset
          )
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;
      setMessages(data as any[] || []);
    } catch (err: any) {
      const serialized = serializeSupabaseError(err);
      console.error("[Chat Debug] Fetch Messages Error:", serialized);
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: `Failed to load messages (Code: ${serialized?.code})` 
      });
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

  const handleSelectChat = (id: string) => {
    setSelectedChatId(id);
    setShowConversation(true);
  };

  const selectedChat = chats.find(c => c.id === selectedChatId);
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
                <p className="text-xs font-medium">Loading conversations...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-rose-500 gap-2">
                <AlertCircle className="w-8 h-8 opacity-50" />
                <p className="text-sm font-bold">Connection Failed</p>
                <p className="text-[11px] leading-relaxed opacity-80">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchChats} className="mt-4 h-8 text-[10px] uppercase font-bold tracking-wider">Retry Connection</Button>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="text-center py-10 opacity-50">
                <p className="text-sm font-medium">No conversations yet</p>
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
                      {chat.type === 'channel' ? <Hash className="w-5 h-5" /> : chat.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={cn(
                      "font-bold text-sm truncate",
                      selectedChatId === chat.id ? "text-primary" : "text-slate-900 dark:text-white"
                    )}>{chat.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {chat.type === 'channel' ? 'Shared channel' : 'Direct Message'}
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
                    {selectedChat.type === 'channel' ? <Hash className="w-4 h-4" /> : selectedChat.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-bold text-sm md:text-base dark:text-white truncate">{selectedChat.name}</p>
                  <p className="text-[10px] md:text-xs text-emerald-500 font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    Active
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="rounded-xl text-slate-400"><Search className="w-5 h-5" /></Button>
                <Button variant="ghost" size="icon" className="rounded-xl text-slate-400"><MoreVertical className="w-5 h-5" /></Button>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 px-4 md:px-8">
              <div className="py-8 space-y-6">
                {loadingMessages ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm font-medium">Syncing history...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                    <MessageSquare className="w-12 h-12 mb-4 text-slate-300" />
                    <p className="font-bold text-lg">No messages here yet</p>
                    <p className="text-sm">Say hello to start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.user_id === userProfile?.id;
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
                            {msg.content}
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
              </div>
            </ScrollArea>

            {/* Input Bar */}
            <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t dark:border-slate-800">
              <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-950 p-2 rounded-2xl border dark:border-slate-800 transition-all focus-within:ring-2 focus-within:ring-primary/20">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary rounded-xl shrink-0"><Paperclip className="w-5 h-5" /></Button>
                <Input 
                  className="border-none shadow-none bg-transparent focus-visible:ring-0 text-base flex-1 dark:text-white" 
                  placeholder="Message..." 
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  disabled={loadingMessages}
                />
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary rounded-xl shrink-0 hidden sm:flex"><Smile className="w-5 h-5" /></Button>
                <Button 
                  size="icon" 
                  className={cn(
                    "rounded-xl shadow-lg transition-all active:scale-95 shrink-0",
                    messageInput.trim() && !loadingMessages ? "bg-primary" : "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
                  )}
                  disabled={!messageInput.trim() || loadingMessages}
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-2">
              <MessageSquare className="w-10 h-10 text-primary/40" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Your Workspace Messenger</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1">
                Select a conversation from the left to start collaborating with your team.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}