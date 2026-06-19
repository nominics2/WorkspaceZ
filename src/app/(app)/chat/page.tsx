
"use client";

import { useState, useEffect } from "react";
import { 
  Send, 
  Search, 
  Plus, 
  ChevronLeft, 
  User, 
  Users, 
  Hash, 
  MoreVertical, 
  Paperclip, 
  Smile,
  MessageSquare,
  CheckCheck,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// --- MOCK DATA ---
const MOCK_CHATS = [
  { id: "1", name: "General", type: "group", lastMessage: "Let's review the new design docs tomorrow.", time: "10:45 AM", unreadCount: 5 },
  { id: "2", name: "Engineering Team", type: "group", lastMessage: "Backend deployment was successful.", time: "9:12 AM", unreadCount: 0 },
  { id: "3", name: "Alex Johnson", type: "dm", lastMessage: "Can you send the API keys?", time: "Yesterday", unreadCount: 1, avatar: "https://picsum.photos/seed/alex/100/100" },
  { id: "4", name: "Sarah Miller", type: "dm", lastMessage: "I'll be OOO on Friday.", time: "Tuesday", unreadCount: 0, avatar: "https://picsum.photos/seed/sarah/100/100" },
  { id: "5", name: "Project Aurora", type: "group", lastMessage: "Milestone 2 reached!", time: "Monday", unreadCount: 0 },
  { id: "6", name: "DevOps", type: "group", lastMessage: "Check the firewall logs please.", time: "Dec 12", unreadCount: 0 },
];

const MOCK_MESSAGES: Record<string, any[]> = {
  "1": [
    { id: "m1", sender: "Alex Johnson", text: "Morning team! How is the progress on the dashboard?", time: "9:00 AM", isMe: false, avatar: "https://picsum.photos/seed/alex/100/100" },
    { id: "m2", sender: "You", text: "Working on the responsive layout fixes right now.", time: "9:05 AM", isMe: true },
    { id: "m3", sender: "Sarah Miller", text: "The new colors look great in dark mode btw.", time: "9:10 AM", isMe: false, avatar: "https://picsum.photos/seed/sarah/100/100" },
    { id: "m4", sender: "You", text: "Glad you like them! Let's review the new design docs tomorrow.", time: "10:45 AM", isMe: true },
  ]
};

export default function ChatPage() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");

  const selectedChat = MOCK_CHATS.find(c => c.id === selectedChatId);
  const messages = selectedChatId ? (MOCK_MESSAGES[selectedChatId] || []) : [];

  const handleSelectChat = (id: string) => {
    setSelectedChatId(id);
    setShowConversation(true);
  };

  const handleBack = () => {
    setShowConversation(false);
  };

  const filteredChats = MOCK_CHATS.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] flex overflow-hidden bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] shadow-2xl animate-in fade-in duration-500">
      
      {/* --- CHAT LIST SIDEBAR --- */}
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
            {filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => handleSelectChat(chat.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all group hover:bg-slate-50 dark:hover:bg-slate-800/50",
                  selectedChatId === chat.id ? "bg-primary/10 dark:bg-primary/10" : ""
                )}
              >
                <div className="relative">
                  <Avatar className="w-12 h-12 border-2 border-white dark:border-slate-800 shadow-sm">
                    {chat.avatar ? (
                      <AvatarImage src={chat.avatar} />
                    ) : (
                      <AvatarFallback className={cn(
                        "bg-primary/10 text-primary font-bold",
                        selectedChatId === chat.id ? "bg-primary text-white" : ""
                      )}>
                        {chat.type === 'group' ? <Hash className="w-5 h-5" /> : chat.name[0]}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                </div>
                
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={cn(
                      "font-bold text-sm truncate",
                      selectedChatId === chat.id ? "text-primary dark:text-primary" : "text-slate-900 dark:text-white"
                    )}>
                      {chat.name}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                      {chat.time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate line-clamp-1">
                      {chat.lastMessage}
                    </p>
                    {chat.unreadCount > 0 && (
                      <Badge className="h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full bg-primary text-white font-bold text-[10px] border-none">
                        {chat.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
            
            {filteredChats.length === 0 && (
              <div className="text-center py-10 opacity-50">
                <p className="text-sm font-medium">No chats found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* --- CONVERSATION VIEW --- */}
      <div className={cn(
        "flex-1 flex flex-col bg-slate-50/30 dark:bg-slate-950/20 transition-all",
        !showConversation ? "hidden md:flex" : "flex"
      )}>
        {selectedChat ? (
          <>
            {/* Header */}
            <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex items-center justify-between z-10">
              <div className="flex items-center gap-4 min-w-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden rounded-xl h-10 w-10" 
                  onClick={handleBack}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                
                <Avatar className="w-10 h-10 border-2 border-white dark:border-slate-800 shadow-sm shrink-0">
                  {selectedChat.avatar ? (
                    <AvatarImage src={selectedChat.avatar} />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {selectedChat.type === 'group' ? <Hash className="w-4 h-4" /> : selectedChat.name[0]}
                    </AvatarFallback>
                  )}
                </Avatar>
                
                <div className="min-w-0">
                  <p className="font-bold text-sm md:text-base dark:text-white truncate">
                    {selectedChat.name}
                  </p>
                  <p className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    {selectedChat.type === 'group' ? '12 members online' : 'Active now'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white">
                  <Search className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 px-4 md:px-8">
              <div className="py-8 space-y-6">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                    <MessageSquare className="w-12 h-12 mb-4 text-slate-300" />
                    <p className="font-bold text-lg">No messages here yet</p>
                    <p className="text-sm">Say hello to start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={msg.id} className={cn(
                      "flex gap-3 max-w-[85%] md:max-w-[70%]",
                      msg.isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}>
                      {!msg.isMe && (
                        <Avatar className="w-8 h-8 shrink-0 shadow-sm mt-1">
                          <AvatarImage src={msg.avatar} />
                          <AvatarFallback className="text-[10px] bg-slate-100 font-bold">{msg.sender[0]}</AvatarFallback>
                        </Avatar>
                      )}
                      
                      <div className={cn(
                        "flex flex-col",
                        msg.isMe ? "items-end" : "items-start"
                      )}>
                        {!msg.isMe && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1 ml-1">
                            {msg.sender}
                          </span>
                        )}
                        <div className={cn(
                          "px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed relative group",
                          msg.isMe 
                            ? "bg-primary text-white rounded-tr-none" 
                            : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border dark:border-slate-700"
                        )}>
                          {msg.text}
                          <div className={cn(
                            "flex items-center gap-1.5 mt-1.5 justify-end opacity-70 text-[9px] font-bold",
                            msg.isMe ? "text-white/80" : "text-slate-400"
                          )}>
                            <span>{msg.time}</span>
                            {msg.isMe && <CheckCheck className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Input Bar */}
            <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t dark:border-slate-800">
              <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-950 p-2 rounded-2xl border dark:border-slate-800 transition-all focus-within:ring-2 focus-within:ring-primary/20">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary rounded-xl shrink-0">
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Input 
                  className="border-none shadow-none bg-transparent focus-visible:ring-0 text-base flex-1 dark:text-white" 
                  placeholder="Message..." 
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      setMessageInput("");
                    }
                  }}
                />
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary rounded-xl shrink-0 hidden sm:flex">
                  <Smile className="w-5 h-5" />
                </Button>
                <Button 
                  size="icon" 
                  className={cn(
                    "rounded-xl shadow-lg transition-all active:scale-95 shrink-0",
                    messageInput.trim() ? "bg-primary" : "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
                  )}
                  disabled={!messageInput.trim()}
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
              <p className="mt-2 text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center hidden md:block">
                Press Enter to send message
              </p>
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
