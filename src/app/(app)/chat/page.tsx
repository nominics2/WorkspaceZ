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
  CheckCircle2
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
    const { data } = await supabase
      .from('workspace_members')
      .select('user_id, profiles(id, full_name, avatar_url)')
      .eq('workspace_id', activeWorkspace.id)
      .eq('status', 'active');
    
    setMembers(data?.map(m => (m.profiles as any)) || []);
  }, [activeWorkspace, supabase]);

  const fetchMessages = useCallback(async (channelId: string) => {
    if (!activeWorkspace) return;
    const { data: msgs, error: msgError } = await supabase
      .from('chat_messages')
      .select('*, profiles:sender_id(full_name, username, avatar_url)')
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
          .select('*, profiles:sender_id(full_name, username, avatar_url)')
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
          profiles:sender_id(full_name, username, avatar_url)
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
      
      setMessages(prev => prev.map(m => m.id === selectedMessage.id ? { ...m, created_task_id: task.id } : m));
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workspace Chat</h1>
          <p className="text-muted-foreground">Collaborate with your team in {activeWorkspace?.name}</p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col border-none shadow-xl overflow-hidden relative">
        <div className="p-4 border-b bg-white flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-primary font-bold">#</span>
            </div>
            <div>
              <p className="font-bold">{channel?.name || 'General'}</p>
              <p className="text-xs text-muted-foreground">{members.length} members in workspace</p>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1 bg-slate-50/50">
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground italic">No messages yet. Start the conversation!</div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === userProfile?.id;
                const profile = msg.profiles;
                return (
                  <div key={msg.id} className={cn("flex gap-3 group", isMe ? "flex-row-reverse" : "")}>
                    <Avatar className="w-10 h-10 border shadow-sm">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                        {profile?.full_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn("max-w-[70%] flex flex-col", isMe ? "items-end" : "items-start")}>
                      <div className={cn("flex items-center gap-2 mb-1 px-1", isMe ? "flex-row-reverse" : "")}>
                        <span className="text-xs font-bold">{profile?.full_name || 'User'}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="relative group/bubble">
                        <div className={cn(
                          "p-4 rounded-2xl shadow-sm break-words whitespace-pre-wrap",
                          isMe ? "bg-primary text-white rounded-tr-none" : "bg-white text-foreground rounded-tl-none border"
                        )}>
                          {msg.message}
                          {msg.created_task_id && (
                            <div className={cn(
                              "mt-2 pt-2 border-t flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider",
                              isMe ? "border-white/20 text-white/80" : "border-slate-100 text-primary"
                            )}>
                              <CheckCircle2 className="w-3 h-3" /> Task Created
                            </div>
                          )}
                        </div>
                        {!msg.created_task_id && (
                          <div className={cn(
                            "absolute top-0 opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-2",
                            isMe ? "-left-12 pr-2" : "-right-12 pl-2"
                          )}>
                             <Button 
                               variant="secondary" 
                               size="icon" 
                               className="h-8 w-8 rounded-full shadow-md bg-white hover:bg-slate-50 border"
                               onClick={() => openTaskModal(msg)}
                               title="Create task from message"
                             >
                               <CheckSquare className="w-4 h-4 text-primary" />
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

        <div className="p-4 bg-white border-t">
          <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl border border-slate-200">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary shrink-0">
              <Paperclip className="w-5 h-5" />
            </Button>
            <Input 
              className="border-none shadow-none bg-transparent focus-visible:ring-0 text-base flex-1" 
              placeholder="Type your message..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={sending}
            />
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary shrink-0">
              <Smile className="w-5 h-5" />
            </Button>
            <Button 
              size="icon" 
              className="rounded-lg shadow-lg shadow-primary/20 shrink-0" 
              onClick={handleSend}
              disabled={sending || !input.trim()}
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={isTaskModalOpen} onOpenChange={(open) => { if (!converting) setIsTaskModalOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Task from Message</DialogTitle>
            <DialogDescription>Convert this chat message into a project assignment.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="t-title">Task Title</Label>
              <Input 
                id="t-title" 
                value={taskForm.title} 
                onChange={e => setTaskForm({...taskForm, title: e.target.value})} 
                required 
                disabled={converting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-desc">Description</Label>
              <Textarea 
                id="t-desc" 
                value={taskForm.description} 
                onChange={e => setTaskForm({...taskForm, description: e.target.value})} 
                rows={4}
                disabled={converting}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={taskForm.priority} onValueChange={v => setTaskForm({...taskForm, priority: v})} disabled={converting}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input 
                  type="date" 
                  value={taskForm.dueDate} 
                  onChange={e => setTaskForm({...taskForm, dueDate: e.target.value})} 
                  disabled={converting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assigned To</Label>
              <Select value={taskForm.assignedTo} onValueChange={v => setTaskForm({...taskForm, assignedTo: v})} disabled={converting}>
                <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsTaskModalOpen(false)} disabled={converting}>Cancel</Button>
              <Button type="submit" disabled={converting}>
                {converting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Convert to Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
