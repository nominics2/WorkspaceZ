"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Send, 
  Smile, 
  Paperclip, 
  MoreVertical, 
  CheckSquare, 
  Plus,
  User,
  Loader2,
  Calendar as CalendarIcon,
  CheckCircle2,
  BadgeCheck,
  Hash,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const { activeWorkspace, userProfile } = useWorkspace();
  const [channel, setChannel] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    assignedTo: ""
  });

  const forceUnlockUI = () => {
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = "";
    }
  };

  useEffect(() => {
    return () => forceUnlockUI();
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  const fetchMembers = useCallback(async () => {
    if (!activeWorkspace) return;
    
    const { data: mData, error: mErr } = await supabase
      .from('workspace_members')
      .select('user_id, is_verified')
      .eq('workspace_id', activeWorkspace.id)
      .eq('status', 'active');
    
    if (mErr) return;

    if (mData && mData.length > 0) {
      const uids = mData.map(m => m.user_id);
      const { data: pData, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, avatar_preset')
        .in('id', uids);
      
      if (pErr) return;

      const merged = mData.map(member => ({
        ...member,
        profiles: pData?.find(p => p.id === member.user_id) || null
      }));
      setMembers(merged);
    } else {
      setMembers([]);
    }
  }, [activeWorkspace, supabase]);

  const fetchMessages = useCallback(async (channelId: string) => {
    if (!activeWorkspace) return;
    const { data: msgs, error: msgError } = await supabase
      .from('chat_messages')
      .select('*, profiles:sender_id(full_name, username, avatar_url, avatar_preset)')
      .eq('channel_id', channelId)
      .eq('workspace_id', activeWorkspace.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (msgError) throw msgError;
    setMessages(msgs || []);
    setTimeout(() => scrollToBottom("auto"), 100);
  }, [activeWorkspace, supabase, scrollToBottom]);

  const fetchChannel = useCallback(async () => {
    if (!activeWorkspace || !userProfile) return;
    setLoading(true);

    try {
      let { data: channels, error: channelError } = await supabase
        .from('chat_channels')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .eq('type', 'workspace')
        .limit(1);

      let currentChannel = channels?.[0];

      if (!currentChannel && !channelError) {
        const { data: newChannel, error: createError } = await supabase
          .from('chat_channels')
          .insert({
            name: "General",
            type: "workspace",
            workspace_id: activeWorkspace.id,
            created_by: userProfile.id
          })
          .select()
          .single();
        
        if (createError) throw createError;
        currentChannel = newChannel;
      }

      setChannel(currentChannel);
      if (currentChannel) {
        await fetchMessages(currentChannel.id);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Chat Error", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, userProfile, supabase, toast, fetchMessages]);

  useEffect(() => {
    fetchChannel();
    fetchMembers();
  }, [fetchChannel, fetchMembers]);

  useEffect(() => {
    if (!channel) return;

    const subscription = supabase
      .channel(`chat:${channel.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `channel_id=eq.${channel.id}`
      }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select('*, profiles:sender_id(full_name, username, avatar_url, avatar_preset)')
          .eq('id', payload.new.id)
          .single();
        
        if (data) {
          setMessages(prev => {
            if (prev.some(m => m.id === data.id)) return prev;
            return [...prev, data];
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${channel.id}`
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [channel, supabase]);

  const handleSend = async () => {
    if (!input.trim() || !channel || !userProfile || !activeWorkspace) return;
    setSending(true);

    try {
      const { data: newMessage, error } = await supabase
        .from('chat_messages')
        .insert({
          channel_id: channel.id,
          workspace_id: activeWorkspace.id,
          sender_id: userProfile.id,
          message: input.trim()
        })
        .select(`
          *,
          profiles:sender_id(full_name, username, avatar_url, avatar_preset)
        `)
        .single();

      if (error) throw error;
      
      if (newMessage) {
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      }
      
      setInput("");
      setTimeout(() => scrollToBottom(), 50);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSending(false);
    }
  };

  const openTaskModal = (msg: any) => {
    if (msg.created_task_id) {
      toast({ title: "Already converted", description: "A task has already been created from this message." });
      return;
    }

    setSelectedMessage(msg);
    const title = msg.message.split('\n')[0].substring(0, 50);
    setTaskForm({
      title,
      description: msg.message,
      priority: "medium",
      dueDate: "",
      assignedTo: userProfile?.id || ""
    });
    setIsTaskModalOpen(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMessage || !activeWorkspace || !userProfile) return;

    setConverting(true);
    try {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          workspace_id: activeWorkspace.id,
          title: taskForm.title,
          description: taskForm.description,
          status: 'to_do',
          priority: taskForm.priority.toLowerCase(),
          assigned_to: taskForm.assignedTo || userProfile.id,
          created_by: userProfile.id,
          due_date: taskForm.dueDate || null,
          progress_mode: 'auto',
          manual_progress: 0
        })
        .select()
        .single();

      if (taskError) throw taskError;

      await supabase
        .from('chat_messages')
        .update({ created_task_id: task.id })
        .eq('id', selectedMessage.id);

      await supabase
        .from('task_message_links')
        .insert({
          task_id: task.id,
          message_id: selectedMessage.id,
          workspace_id: activeWorkspace.id,
          created_by: userProfile.id
        });

      toast({ title: "Task Created", description: "The message has been successfully converted into a task." });
      setIsTaskModalOpen(false);
      setSelectedMessage(null);
      forceUnlockUI();
      
      setMessages(prev => prev.map(m => m.id === selectedMessage.id ? { ...m, created_task_id: task.id } : m));
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setConverting(false);
      forceUnlockUI();
    }
  };

  return (
    <div className="h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] flex flex-col gap-4 animate-in fade-in duration-500 pb-safe">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-slate-100">Workspace Chat</h1>
          <p className="text-muted-foreground text-sm">Collaborate in real-time with your {activeWorkspace?.name} team</p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col border-none shadow-2xl overflow-hidden relative dark:bg-slate-900 rounded-[2rem]">
        {/* Chat Header */}
        <div className="p-4 md:p-6 border-b dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
              <Hash className="text-primary w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-lg dark:text-slate-100 truncate">{channel?.name || 'General'}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {members.length} members</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <span className="text-emerald-500 font-bold">Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
              <Plus className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 bg-slate-50/30 dark:bg-slate-950/20 px-4 md:px-6">
          <div className="py-8 space-y-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 opacity-70">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                   <MessageSquare className="w-10 h-10 text-slate-300" />
                </div>
                <div>
                   <p className="font-bold text-lg dark:text-slate-100">No messages yet</p>
                   <p className="text-sm text-muted-foreground">Start the conversation with your team!</p>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = msg.sender_id === userProfile?.id;
                const profile = msg.profiles;
                const avatarSrc = profile?.avatar_preset ? `/avatars/${profile.avatar_preset}.png` : profile?.avatar_url;
                const senderMembership = members.find(m => m.user_id === msg.sender_id);
                const isVerified = !!senderMembership?.is_verified;

                // Group messages from same user within 2 minutes
                const prevMsg = messages[idx - 1];
                const showHeader = !prevMsg || prevMsg.sender_id !== msg.sender_id || 
                                  (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 120000);

                return (
                  <div key={msg.id} className={cn(
                    "flex gap-4 group transition-all",
                    isMe ? "flex-row-reverse" : "flex-row",
                    showHeader ? "mt-6" : "mt-1"
                  )}>
                    <div className={cn("shrink-0 w-10 flex flex-col items-center", !showHeader && "opacity-0")}>
                      <Avatar className="w-10 h-10 border-2 border-white dark:border-slate-800 shadow-md">
                        <AvatarImage src={avatarSrc} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-extrabold uppercase">
                          {profile?.full_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    <div className={cn("max-w-[80%] md:max-w-[70%] flex flex-col", isMe ? "items-end" : "items-start")}>
                      {showHeader && (
                        <div className={cn("flex items-center gap-2 mb-1.5 px-1", isMe ? "flex-row-reverse" : "flex-row")}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{profile?.full_name || 'User'}</span>
                            {isVerified && <BadgeCheck className="w-3.5 h-3.5 text-primary fill-primary/10" />}
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                      
                      <div className="relative group/bubble flex items-center gap-2">
                        <div className={cn(
                          "px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed break-words whitespace-pre-wrap transition-all",
                          isMe 
                            ? "bg-primary text-white rounded-tr-none" 
                            : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-700"
                        )}>
                          {msg.message}
                          
                          {msg.created_task_id && (
                            <div className={cn(
                              "mt-3 pt-2 border-t flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest",
                              isMe ? "border-white/20 text-white/80" : "border-slate-100 dark:border-slate-700 text-primary"
                            )}>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Task Created
                            </div>
                          )}
                        </div>

                        {!msg.created_task_id && (
                          <div className={cn(
                            "opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center shrink-0",
                            isMe ? "order-first" : ""
                          )}>
                             <Button 
                               variant="secondary" 
                               size="icon" 
                               className="h-9 w-9 rounded-xl shadow-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border dark:border-slate-700"
                               onClick={() => openTaskModal(msg)}
                               title="Create task from message"
                             >
                               <CheckSquare className="w-4.5 h-4.5 text-primary" />
                             </Button>
                          </div>
                        )}
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
          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary hover:bg-white dark:hover:bg-slate-800 rounded-xl shrink-0 transition-colors">
              <Paperclip className="w-5 h-5" />
            </Button>
            <Input 
              className="border-none shadow-none bg-transparent focus-visible:ring-0 text-base flex-1 dark:text-slate-100 h-10 px-0" 
              placeholder="Message your team..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={sending}
            />
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary hover:bg-white dark:hover:bg-slate-800 rounded-xl shrink-0 hidden sm:flex transition-colors">
              <Smile className="w-5 h-5" />
            </Button>
            <Button 
              size="icon" 
              className={cn(
                "rounded-xl shadow-xl transition-all active:scale-95 shrink-0 w-10 h-10",
                input.trim() ? "bg-primary shadow-primary/20" : "bg-slate-300 dark:bg-slate-700 cursor-not-allowed shadow-none"
              )} 
              onClick={handleSend}
              disabled={sending || !input.trim()}
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
          <div className="mt-2 text-[9px] text-center text-slate-400 font-bold uppercase tracking-[0.2em] hidden md:block">
            Press <span className="text-slate-500">Enter</span> to send • <span className="text-slate-500">Shift+Enter</span> for new line
          </div>
        </div>
      </Card>

      {/* Convert to Task Dialog */}
      <Dialog open={isTaskModalOpen} onOpenChange={(open) => { 
        if (!converting) {
          setIsTaskModalOpen(open);
          if (!open) forceUnlockUI();
        }
      }}>
        <DialogContent className="max-w-md dark:bg-slate-950 dark:border-slate-800 rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-8 space-y-6">
            <DialogHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-2">
                <CheckSquare className="text-primary w-6 h-6" />
              </div>
              <DialogTitle className="text-2xl font-bold dark:text-slate-100">Create Task</DialogTitle>
              <DialogDescription>Transform this message into a tracked assignment.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateTask} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="t-title" className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Title</Label>
                <Input 
                  id="t-title" 
                  value={taskForm.title} 
                  onChange={e => setTaskForm({...taskForm, title: e.target.value})} 
                  required 
                  disabled={converting}
                  className="h-11 rounded-xl dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-desc" className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Description</Label>
                <Textarea 
                  id="t-desc" 
                  value={taskForm.description} 
                  onChange={e => setTaskForm({...taskForm, description: e.target.value})} 
                  rows={3}
                  disabled={converting}
                  className="rounded-xl dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Priority</Label>
                  <Select value={taskForm.priority} onValueChange={v => setTaskForm({...taskForm, priority: v})} disabled={converting}>
                    <SelectTrigger className="h-11 rounded-xl dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent className="dark:bg-slate-900 dark:border-slate-800 rounded-xl">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Due Date</Label>
                  <Input 
                    type="date" 
                    value={taskForm.dueDate} 
                    onChange={e => setTaskForm({...taskForm, dueDate: e.target.value})} 
                    disabled={converting}
                    className="h-11 rounded-xl dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 border-slate-200"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Assign To</Label>
                <Select value={taskForm.assignedTo} onValueChange={v => setTaskForm({...taskForm, assignedTo: v})} disabled={converting}>
                  <SelectTrigger className="h-11 rounded-xl dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 border-slate-200"><SelectValue placeholder="Select member" /></SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800 rounded-xl">
                    {members.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        <div className="flex items-center gap-2">
                           <Avatar className="w-5 h-5">
                             <AvatarImage src={m.profiles?.avatar_preset ? `/avatars/${m.profiles.avatar_preset}.png` : m.profiles?.avatar_url} />
                             <AvatarFallback className="text-[8px]">{m.profiles?.full_name?.[0]}</AvatarFallback>
                           </Avatar>
                           <span>{(m.profiles as any)?.full_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-4 flex-row gap-3">
                <Button type="button" variant="ghost" onClick={() => { setIsTaskModalOpen(false); forceUnlockUI(); }} disabled={converting} className="flex-1 h-12 rounded-xl dark:text-slate-300 dark:hover:bg-slate-800">Cancel</Button>
                <Button type="submit" disabled={converting} className="flex-1 h-12 rounded-xl shadow-xl shadow-primary/20">
                  {converting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Assign Task
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
