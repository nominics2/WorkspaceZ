"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Loader2,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  MessageSquare,
  Paperclip,
  Download,
  Trash2,
  FileIcon,
  X,
  Eye,
  Layout,
  Check,
  User,
  AlertCircle,
  CalendarDays,
  UserCheck,
  UserPlus,
  Ban,
  FilterX,
  Circle,
  Settings2,
  BadgeCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { useSearchParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function TasksPageContent() {
  const { activeWorkspace, userProfile } = useWorkspace();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<any[]>([]);
  const [subWorkspaces, setSubWorkspaces] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Advanced Filters
  const [filters, setFilters] = useState({
    status: [] as string[],
    priority: [] as string[],
    teamId: "all",
    assignedTo: "all",
    overdue: false,
    dueSoon: false,
    createdByMe: false,
    assignedToMe: false,
    noDueDate: false
  });

  const supabase = createClient();
  const { toast } = useToast();

  const forceUnlockUI = useCallback(() => {
    if (typeof document !== 'undefined') {
      setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 0);
    }
  }, []);

  useEffect(() => {
    forceUnlockUI();
    return () => forceUnlockUI();
  }, [forceUnlockUI]);

  const fetchData = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const [tasksRes, teamsRes] = await Promise.all([
        supabase
          .from('my_tasks_view')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('sub_workspaces')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .order('name', { ascending: true })
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (teamsRes.error) throw teamsRes.error;

      // Fetch members in two steps to avoid ambiguous joins with profiles
      const { data: mData, error: mErr } = await supabase
        .from('workspace_members')
        .select('user_id, is_verified')
        .eq('workspace_id', activeWorkspace.id)
        .eq('status', 'active');
      
      if (mErr) throw mErr;

      let mergedMembers = [];
      if (mData && mData.length > 0) {
        const uids = mData.map(m => m.user_id);
        const { data: pData, error: pErr } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, avatar_preset')
          .in('id', uids);
        
        if (pErr) throw pErr;
        
        mergedMembers = mData.map(member => ({
          ...member,
          profiles: pData?.find(p => p.id === member.user_id) || null
        }));
      }

      setTasks(tasksRes.data || []);
      setSubWorkspaces(teamsRes.data || []);
      setMembers(mergedMembers);

      const taskId = searchParams.get('taskId');
      if (taskId) {
        const task = tasksRes.data?.find(t => t.id === taskId);
        if (task) handleOpenDetail(task);
      }
      
      const teamId = searchParams.get('teamId');
      if (teamId) setFilters(f => ({ ...f, teamId }));

    } catch (err: any) {
      toast({ variant: "destructive", title: "Error fetching data", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, supabase, toast, searchParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchTaskDetails = async (taskId: string) => {
    try {
      const [
        { data: st }, 
        { data: c }, 
        { data: al }, 
        { data: att }
      ] = await Promise.all([
        supabase.from('subtasks').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
        supabase.from('task_comments').select('*, profiles(full_name, avatar_url, avatar_preset)').eq('task_id', taskId).order('created_at', { ascending: true }),
        supabase.from('task_activity_logs').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
        supabase.from('attachments').select('*').eq('task_id', taskId).order('created_at', { ascending: false })
      ]);

      // Join is_verified into comments
      const enrichedComments = (c || []).map(comment => {
        const membership = members.find(m => m.user_id === comment.user_id);
        return { ...comment, is_verified: !!membership?.is_verified };
      });

      setSubtasks(st || []);
      setComments(enrichedComments);
      setActivityLogs(al || []);
      setAttachments(att || []);
    } catch (err: any) {
      console.error("Error fetching task details:", err);
    }
  };

  const handleOpenDetail = (task: any) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
    fetchTaskDetails(task.id);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTask || !activeWorkspace || !userProfile) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Maximum file size is 5MB." });
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${activeWorkspace.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('workspace-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('attachments').insert({
        workspace_id: activeWorkspace.id,
        task_id: selectedTask.id,
        uploaded_by: userProfile.id,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size_bytes: file.size
      });

      if (dbError) throw dbError;

      toast({ title: "Upload successful", description: `${file.name} has been attached.` });
      fetchTaskDetails(selectedTask.id);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleOpenAttachment = async (attachment: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('workspace-attachments')
        .createSignedUrl(attachment.file_path, 600);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error opening file", description: err.message });
    }
  };

  const handleDownloadAttachment = async (attachment: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('workspace-attachments')
        .download(attachment.file_path);
      if (error) throw error;
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.file_name);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Download failed", description: err.message });
    }
  };

  const handleDeleteAttachment = async (attachment: any) => {
    try {
      const { error: storageError } = await supabase.storage.from('workspace-attachments').remove([attachment.file_path]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from('attachments').delete().eq('id', attachment.id);
      if (dbError) throw dbError;
      toast({ title: "File deleted" });
      fetchTaskDetails(selectedTask.id);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Delete failed", description: err.message });
    }
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const priority = (formData.get("priority") as string || "medium").toLowerCase();
    const dueDate = formData.get("due_date") as string;
    const subWsId = formData.get("sub_workspace_id") as string;
    const assignedTo = formData.get("assigned_to") as string;

    setSaving(true);
    try {
      const { data: createdTask, error } = await supabase.from('tasks').insert({
        workspace_id: activeWorkspace?.id,
        sub_workspace_id: subWsId && subWsId !== "none" ? subWsId : null,
        title,
        description,
        priority: priority,
        status: 'to_do',
        due_date: dueDate && dueDate.trim() !== "" ? dueDate : null,
        created_by: userProfile.id,
        assigned_to: assignedTo && assignedTo !== "none" ? assignedTo : userProfile.id,
        progress_mode: 'auto',
        manual_progress: 0
      }).select().single();

      if (error) throw error;

      // Notify team if sub_workspace is assigned
      if (createdTask.sub_workspace_id) {
        supabase.rpc("notify_task_team_members", {
          p_task_id: createdTask.id,
          p_event: "task_assigned_to_team",
        });
      }

      toast({ title: "Success", description: "Task created successfully" });
      setIsCreateOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
      forceUnlockUI();
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('move_task_to_trash', {
        p_task_id: selectedTask.id
      });
      if (error) throw error;
      toast({ title: "Task moved to trash" });
      setIsDetailOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (task: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const newStatus = task.status === 'completed' ? 'to_do' : 'completed';
    const newProgress = newStatus === 'completed' ? 100 : task.manual_progress;
    
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, manual_progress: newProgress })
        .eq('id', task.id);

      if (error) throw error;
      
      toast({ title: newStatus === 'completed' ? "Task marked as complete" : "Task marked as incomplete" });
      
      if (selectedTask?.id === task.id) {
        setSelectedTask({ ...selectedTask, status: newStatus, manual_progress: newProgress });
      }
      
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleToggleSubtask = async (subtask: any) => {
    try {
      await supabase.from('subtasks').update({ is_completed: !subtask.is_completed }).eq('id', subtask.id);
      await fetchTaskDetails(selectedTask.id);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTask) return;
    setSaving(true);
    try {
      await supabase.from('task_comments').insert({
        task_id: selectedTask.id,
        user_id: userProfile.id,
        comment: newComment
      });
      setNewComment("");
      fetchTaskDetails(selectedTask.id);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubtask = async () => {
    if (!selectedTask || !userProfile) return;
    if (!newSubtaskTitle.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('subtasks')
        .insert({
          task_id: selectedTask.id,
          title: newSubtaskTitle.trim(),
          created_by: userProfile.id,
          is_completed: false
        });

      if (error) throw error;

      setNewSubtaskTitle("");
      await fetchTaskDetails(selectedTask.id);
      await fetchData();
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "Error adding subtask", 
        description: err.message 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateManualProgress = async (val: number[]) => {
    if (!selectedTask) return;
    try {
      await supabase.from('tasks').update({ manual_progress: val[0] }).eq('id', selectedTask.id);
      setSelectedTask({...selectedTask, manual_progress: val[0]});
      fetchData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSwitchProgressMode = async (mode: 'auto' | 'manual') => {
    if (!selectedTask) return;
    try {
      await supabase.from('tasks').update({ progress_mode: mode }).eq('id', selectedTask.id);
      setSelectedTask({...selectedTask, progress_mode: mode});
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error updating mode", description: err.message });
    }
  };

  const handleUpdateDueDate = async (date: string) => {
    if (!selectedTask) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ due_date: date || null })
        .eq('id', selectedTask.id);

      if (error) throw error;
      
      setSelectedTask({ ...selectedTask, due_date: date });
      toast({ title: "Due date updated" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTeam = async (teamId: string) => {
    if (!selectedTask) return;
    const newTeamId = teamId === "none" ? null : teamId;
    if (selectedTask.sub_workspace_id === newTeamId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ sub_workspace_id: newTeamId })
        .eq('id', selectedTask.id);

      if (error) throw error;
      
      // Notify team if a new team is assigned
      if (newTeamId) {
        supabase.rpc("notify_task_team_members", {
          p_task_id: selectedTask.id,
          p_event: "task_assigned_to_team",
        });
      }

      setSelectedTask({ ...selectedTask, sub_workspace_id: newTeamId });
      toast({ title: "Team assignment updated" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error updating team", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const detailProgress = useMemo(() => {
    if (!selectedTask) return 0;
    if (selectedTask.progress_mode === 'manual') return selectedTask.manual_progress || 0;
    if (subtasks.length === 0) return 0;
    const completed = subtasks.filter(s => s.is_completed).length;
    return Math.round((completed / subtasks.length) * 100);
  }, [selectedTask, subtasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || t.description?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (filters.status.length > 0 && !filters.status.includes(t.status)) return false;
      if (filters.priority.length > 0 && !filters.priority.includes(t.priority)) return false;
      if (filters.teamId !== "all") {
        if (filters.teamId === "none" && t.sub_workspace_id) return false;
        if (filters.teamId !== "none" && t.sub_workspace_id !== filters.teamId) return false;
      }
      if (filters.assignedTo !== "all" && t.assigned_to !== filters.assignedTo) return false;
      
      const now = new Date();
      if (filters.overdue && (!t.due_date || new Date(t.due_date) > now || t.status === 'completed')) return false;
      if (filters.dueSoon) {
        if (!t.due_date) return false;
        const due = new Date(t.due_date);
        const soon = new Date();
        soon.setDate(soon.getDate() + 3);
        if (due > soon || due < now) return false;
      }
      if (filters.createdByMe && t.created_by !== userProfile?.id) return false;
      if (filters.assignedToMe && t.assigned_to !== userProfile?.id) return false;
      if (filters.noDueDate && t.due_date) return false;

      return true;
    });
  }, [tasks, searchTerm, filters, userProfile?.id]);

  const resetFilters = () => setFilters({
    status: [],
    priority: [],
    teamId: "all",
    assignedTo: "all",
    overdue: false,
    dueSoon: false,
    createdByMe: false,
    assignedToMe: false,
    noDueDate: false
  });

  const getAssigneeData = (task: any) => {
    const member = members.find(m => m.user_id === task.assigned_to);
    if (!member) return { avatar: null, isVerified: false };
    return {
      avatar: member.profiles?.avatar_preset ? `/avatars/${member.profiles.avatar_preset}.png` : member.profiles?.avatar_url,
      isVerified: !!member.is_verified
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-slate-100">Tasks</h1>
          <p className="text-muted-foreground">Manage and track your project assignments</p>
        </div>
        <Button 
          className="flex items-center gap-2 py-6 px-6 shadow-lg shadow-primary/20"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="w-5 h-5" /> New Task
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border dark:border-slate-800">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input 
              className="pl-10 border-none shadow-none focus-visible:ring-0 dark:bg-slate-900 dark:text-slate-100" 
              placeholder="Search tasks..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto px-2">
             <DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}>
                <DropdownMenuTrigger asChild>
                   <Button variant="outline" size="sm" className="gap-2 border-none bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-100">
                      <Filter className="w-4 h-4" /> 
                      Filters
                      {(filters.status.length > 0 || filters.priority.length > 0 || filters.overdue || filters.dueSoon || filters.teamId !== 'all') && (
                        <Badge variant="default" className="h-4 w-4 p-0 flex items-center justify-center text-[8px] bg-primary">
                          !
                        </Badge>
                      )}
                   </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 dark:bg-slate-900 dark:border-slate-800">
                   <DropdownMenuLabel className="dark:text-slate-100">Status</DropdownMenuLabel>
                   {['to_do', 'in_progress', 'completed', 'waiting'].map(s => (
                     <DropdownMenuCheckboxItem 
                       key={s} 
                       checked={filters.status.includes(s)}
                       onCheckedChange={(checked) => setFilters(f => ({
                         ...f, 
                         status: checked ? [...f.status, s] : f.status.filter(x => x !== s)
                       }))}
                       className="capitalize dark:text-slate-300"
                     >
                       {s.replace('_', ' ')}
                     </DropdownMenuCheckboxItem>
                   ))}
                   <DropdownMenuSeparator className="dark:bg-slate-800" />
                   <DropdownMenuLabel className="dark:text-slate-100">Priority</DropdownMenuLabel>
                   {['low', 'medium', 'high', 'urgent'].map(p => (
                     <DropdownMenuCheckboxItem 
                       key={p} 
                       checked={filters.priority.includes(p)}
                       onCheckedChange={(checked) => setFilters(f => ({
                         ...f, 
                         priority: checked ? [...f.priority, p] : f.priority.filter(x => x !== p)
                       }))}
                       className="capitalize dark:text-slate-300"
                     >
                       {p}
                     </DropdownMenuCheckboxItem>
                   ))}
                   <DropdownMenuSeparator className="dark:bg-slate-800" />
                   <DropdownMenuCheckboxItem 
                     checked={filters.overdue} 
                     onCheckedChange={(c) => setFilters(f => ({...f, overdue: c}))}
                     className="dark:text-slate-300"
                   >
                     Overdue
                   </DropdownMenuCheckboxItem>
                   <DropdownMenuCheckboxItem 
                     checked={filters.dueSoon} 
                     onCheckedChange={(c) => setFilters(f => ({...f, dueSoon: c}))}
                     className="dark:text-slate-300"
                   >
                     Due Soon (3 Days)
                   </DropdownMenuCheckboxItem>
                   <DropdownMenuCheckboxItem 
                     checked={filters.noDueDate} 
                     onCheckedChange={(c) => setFilters(f => ({...f, noDueDate: c}))}
                     className="dark:text-slate-300"
                   >
                     No Due Date
                   </DropdownMenuCheckboxItem>
                   <DropdownMenuSeparator className="dark:bg-slate-800" />
                   <DropdownMenuItem onClick={resetFilters} className="text-rose-500 gap-2 dark:hover:bg-rose-500/10">
                     <FilterX className="w-4 h-4" /> Reset Filters
                   </DropdownMenuItem>
                </DropdownMenuContent>
             </DropdownMenu>

             <Separator orientation="vertical" className="h-6 mx-2 hidden md:block dark:bg-slate-800" />

             <Select value={filters.teamId} onValueChange={(v) => setFilters(f => ({...f, teamId: v}))}>
               <SelectTrigger className="w-[140px] border-none shadow-none bg-slate-50 dark:bg-slate-800 text-xs h-8 rounded-lg dark:text-slate-100">
                 <Layout className="w-3 h-3 mr-2" />
                 <SelectValue placeholder="Team" />
               </SelectTrigger>
               <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                 <SelectItem value="all">All Teams</SelectItem>
                 <SelectItem value="none">No Team</SelectItem>
                 {subWorkspaces.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
               </SelectContent>
             </Select>

             <Select value={filters.assignedTo} onValueChange={(v) => setFilters(f => ({...f, assignedTo: v}))}>
               <SelectTrigger className="w-[140px] border-none shadow-none bg-slate-50 dark:bg-slate-800 text-xs h-8 rounded-lg dark:text-slate-100">
                 <User className="w-3 h-3 mr-2" />
                 <SelectValue placeholder="Assignee" />
               </SelectTrigger>
               <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                 <SelectItem value="all">All Users</SelectItem>
                 {members.map(m => (
                   <SelectItem key={m.user_id} value={m.user_id}>{(m.profiles as any)?.full_name}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
           <Button 
            variant={filters.assignedToMe ? "default" : "secondary"} 
            size="sm" 
            className="rounded-full text-[10px] h-7 px-4 font-bold uppercase tracking-wider dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            onClick={() => setFilters(f => ({...f, assignedToMe: !f.assignedToMe}))}
           >
            <UserCheck className="w-3 h-3 mr-1.5" /> Assigned to Me
           </Button>
           <Button 
            variant={filters.overdue ? "destructive" : "secondary"} 
            size="sm" 
            className="rounded-full text-[10px] h-7 px-4 font-bold uppercase tracking-wider dark:bg-slate-800 dark:text-slate-300"
            onClick={() => setFilters(f => ({...f, overdue: !f.overdue}))}
           >
            <AlertCircle className="w-3 h-3 mr-1.5" /> Overdue
           </Button>
           <Button 
            variant={filters.dueSoon ? "default" : "secondary"} 
            size="sm" 
            className="rounded-full text-[10px] h-7 px-4 font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
            onClick={() => setFilters(f => ({...f, dueSoon: !f.dueSoon}))}
           >
            <Clock className="w-3 h-3 mr-1.5" /> Due Soon
           </Button>
           <Button 
            variant={filters.noDueDate ? "default" : "secondary"} 
            size="sm" 
            className="rounded-full text-[10px] h-7 px-4 font-bold uppercase tracking-wider dark:bg-slate-800 dark:text-slate-300"
            onClick={() => setFilters(f => ({...f, noDueDate: !f.noDueDate}))}
           >
            No Due Date
           </Button>
           <Button 
            variant={filters.status.includes('completed') ? "default" : "secondary"} 
            size="sm" 
            className="rounded-full text-[10px] h-7 px-4 font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
            onClick={() => setFilters(f => ({...f, status: f.status.includes('completed') ? f.status.filter(x => x !== 'completed') : [...f.status, 'completed']}))}
           >
            Completed
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading && !saving ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm border dark:border-slate-800">
              <Ban className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-lg text-slate-900 dark:text-slate-100">No tasks found</p>
              <p className="text-muted-foreground text-sm max-w-xs">Try adjusting your filters or search terms to find what you're looking for.</p>
            </div>
            <Button variant="outline" onClick={resetFilters} className="dark:border-slate-800 dark:text-slate-100">Clear All Filters</Button>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const taskProgress = task.progress_mode === 'manual' ? (task.manual_progress || 0) : (task.calculated_progress || 0);
            const { avatar: avatarSrc, isVerified } = getAssigneeData(task);

            return (
              <Card 
                key={task.id} 
                className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden cursor-pointer dark:bg-slate-900"
                onClick={() => handleOpenDetail(task)}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className={cn(
                      "w-full md:w-1.5 h-1.5 md:h-auto",
                      task.priority?.toLowerCase() === 'urgent' ? "bg-rose-500" : 
                      task.priority?.toLowerCase() === 'high' ? "bg-amber-500" : "bg-primary"
                    )} />
                    <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center gap-6">
                      <div className="flex items-center gap-4 shrink-0">
                        <button 
                          onClick={(e) => handleToggleStatus(task, e)}
                          className="hover:scale-110 transition-transform"
                        >
                          {task.status === 'completed' ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-500 fill-emerald-50 dark:fill-emerald-500/10" />
                          ) : (
                            <Circle className="w-6 h-6 text-slate-300 dark:text-slate-700" />
                          )}
                        </button>
                      </div>
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={cn(
                            "font-bold text-lg group-hover:text-primary transition-colors uppercase first-letter:capitalize dark:text-slate-100",
                            task.status === 'completed' && "line-through text-muted-foreground"
                          )}>
                            {task.title}
                          </h3>
                          <Badge variant="outline" className="text-[10px] rounded-sm capitalize border-slate-200 dark:border-slate-800 dark:text-slate-400">{task.priority}</Badge>
                          {task.sub_workspace_name && (
                             <Badge variant="secondary" className="text-[10px] bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-none">
                               <Layout className="w-2.5 h-2.5 mr-1" /> {task.sub_workspace_name}
                             </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{task.description || 'No description'}</p>
                      </div>

                      <div className="flex items-center gap-8 min-w-[300px]">
                        <div className="space-y-1">
                          <p className={cn(
                            "text-xs font-medium flex items-center gap-1",
                            task.is_overdue ? "text-rose-500 font-bold" : "text-muted-foreground"
                          )}>
                            <CalendarIcon className="w-3 h-3" /> {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                          </p>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-6 h-6 border dark:border-slate-800 shadow-sm">
                              <AvatarImage src={avatarSrc || undefined} />
                              <AvatarFallback className="bg-primary/10 text-[8px] font-bold text-primary">
                                {task.assigned_to_name?.[0] || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-foreground font-medium dark:text-slate-300">{task.assigned_to_name || 'Unassigned'}</span>
                              {isVerified && <BadgeCheck className="w-3 h-3 text-primary shrink-0" />}
                            </div>
                          </div>
                        </div>

                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Progress</span>
                            <span className="text-xs font-bold text-primary">{Math.round(taskProgress)}%</span>
                          </div>
                          <Progress value={taskProgress} className="h-1.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) forceUnlockUI(); }}>
        <DialogContent className="max-w-md dark:bg-slate-950 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100">Create New Task</DialogTitle>
            <DialogDescription>Add a new assignment to {activeWorkspace?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="dark:text-slate-300">Task Title</Label>
              <Input id="title" name="title" placeholder="What needs to be done?" required disabled={saving} className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="dark:text-slate-300">Description</Label>
              <Textarea id="description" name="description" placeholder="Add more details..." disabled={saving} className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sub_workspace_id" className="dark:text-slate-300">Assign to Team</Label>
                <Select name="sub_workspace_id" defaultValue="none">
                  <SelectTrigger disabled={saving} className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                    <SelectItem value="none">Workspace General</SelectItem>
                    {subWorkspaces.map(team => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assigned_to" className="dark:text-slate-300">Assign to Member</Label>
                <Select name="assigned_to" defaultValue={userProfile?.id}>
                  <SelectTrigger disabled={saving} className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"><SelectValue placeholder="Select member" /></SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                    <SelectItem value="none">Unassigned</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{(m.profiles as any)?.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority" className="dark:text-slate-300">Priority</Label>
                <Select name="priority" defaultValue="medium">
                  <SelectTrigger disabled={saving} className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date" className="dark:text-slate-300">Due Date</Label>
                <Input id="due_date" name="due_date" type="date" disabled={saving} className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100" />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => { setIsCreateOpen(false); forceUnlockUI(); }} disabled={saving} className="dark:text-slate-300 dark:hover:bg-slate-800">Cancel</Button>
              <Button type="submit" disabled={saving} className="shadow-lg shadow-primary/20">
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={isDetailOpen} onOpenChange={(open) => { setIsDetailOpen(open); if (!open) forceUnlockUI(); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto dark:bg-slate-950 dark:border-slate-800">
          {selectedTask && (
            <div className="space-y-8 pt-6">
              <SheetHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="capitalize dark:border-slate-800 dark:text-slate-400">{selectedTask.priority}</Badge>
                    <Badge variant="secondary" className="capitalize dark:bg-slate-900 dark:text-slate-300">{selectedTask.status?.replace('_', ' ')}</Badge>
                    {selectedTask.sub_workspace_name && (
                      <Badge variant="secondary" className="bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-none">
                        {selectedTask.sub_workspace_name}
                      </Badge>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600"
                    onClick={handleDeleteTask}
                    disabled={saving}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <SheetTitle className={cn(
                      "text-2xl font-bold dark:text-slate-100",
                      selectedTask.status === 'completed' && "line-through text-muted-foreground"
                    )}>
                      {selectedTask.title}
                    </SheetTitle>
                    <SheetDescription className="dark:text-slate-400">{selectedTask.description || 'No description provided.'}</SheetDescription>
                  </div>
                  <Button 
                    variant={selectedTask.status === 'completed' ? "outline" : "default"}
                    size="sm"
                    className="shrink-0 gap-2 dark:border-slate-800"
                    onClick={() => handleToggleStatus(selectedTask)}
                  >
                    {selectedTask.status === 'completed' ? (
                      <>Reopen Task</>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Mark Complete
                      </>
                    )}
                  </Button>
                </div>
              </SheetHeader>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <CalendarDays className="w-3 h-3" /> Due Date
                    </Label>
                    <Input 
                      type="date" 
                      value={selectedTask.due_date ? selectedTask.due_date.split('T')[0] : ''} 
                      onChange={(e) => handleUpdateDueDate(e.target.value)}
                      className="h-9 text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-100"
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3 h-3" /> Assignee
                    </Label>
                    <div className="flex items-center gap-2 h-9 px-3 bg-white dark:bg-slate-950 rounded-md border border-slate-200 dark:border-slate-800 opacity-60">
                       <Avatar className="w-5 h-5 border dark:border-slate-800 shadow-sm">
                         <AvatarImage src={getAssigneeData(selectedTask).avatar || undefined} />
                         <AvatarFallback className="bg-primary/10 text-[8px] font-bold text-primary">
                           {selectedTask.assigned_to_name?.[0] || '?'}
                         </AvatarFallback>
                       </Avatar>
                       <div className="flex items-center gap-1 overflow-hidden">
                         <span className="text-sm truncate dark:text-slate-300">{selectedTask.assigned_to_name || 'Unassigned'}</span>
                         {getAssigneeData(selectedTask).isVerified && <BadgeCheck className="w-3 h-3 text-primary shrink-0" />}
                       </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Layout className="w-3 h-3" /> Team Assignment
                    </Label>
                    <Select 
                      value={selectedTask.sub_workspace_id || "none"} 
                      onValueChange={handleUpdateTeam}
                      disabled={saving}
                    >
                      <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-100">
                        <SelectValue placeholder="No team assigned" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                        <SelectItem value="none">No Team (General)</SelectItem>
                        {subWorkspaces.map(team => (
                          <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                   <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-primary" />
                        <Label className="text-sm font-bold dark:text-slate-100">Progress Tracking</Label>
                     </div>
                     <Select 
                      value={selectedTask.progress_mode} 
                      onValueChange={(v: any) => handleSwitchProgressMode(v)}
                     >
                       <SelectTrigger className="w-[140px] h-8 text-[10px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-100">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                         <SelectItem value="auto">Auto (Subtasks)</SelectItem>
                         <SelectItem value="manual">Manual Slider</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                   
                   {selectedTask.progress_mode === 'manual' ? (
                     <div className="space-y-4 pt-2">
                       <Slider 
                         value={[selectedTask.manual_progress || 0]} 
                         onValueChange={handleUpdateManualProgress} 
                         max={100} 
                         step={1} 
                         disabled={saving || selectedTask.status === 'completed'}
                       />
                       <p className="text-xs text-center font-bold text-primary">{selectedTask.manual_progress}% Complete</p>
                     </div>
                   ) : (
                     <div className="space-y-2 pt-2">
                       <Progress value={detailProgress} className="h-2" />
                       <div className="flex justify-between items-center text-[10px] font-bold text-primary uppercase">
                         <span>Auto Mode</span>
                         <span>{detailProgress}% Complete</span>
                       </div>
                     </div>
                   )}
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold flex items-center gap-2 dark:text-slate-100">
                    <CheckCircle2 className="w-4 h-4 text-primary" /> Subtasks
                  </h4>
                  <div className="space-y-2">
                    {subtasks.map((st) => (
                      <div key={st.id} className="flex items-center justify-between group p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={st.is_completed} 
                            onChange={() => handleToggleSubtask(st)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-800 text-primary focus:ring-primary dark:bg-slate-950"
                            disabled={saving}
                          />
                          <span className={cn("text-sm dark:text-slate-300", st.is_completed && "line-through text-muted-foreground")}>{st.title}</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-2">
                      <Input 
                        placeholder="Add subtask..." 
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                        className="h-9 text-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold flex items-center gap-2 dark:text-slate-100">
                    <MessageSquare className="w-4 h-4 text-primary" /> Comments
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                      {comments.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No comments yet.</p>
                      ) : (
                        comments.map((c) => {
                          const cAvatar = c.profiles?.avatar_preset ? `/avatars/${c.profiles.avatar_preset}.png` : c.profiles?.avatar_url;
                          return (
                            <div key={c.id} className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg space-y-2">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <Avatar className="w-5 h-5 border dark:border-slate-800 shadow-sm">
                                    <AvatarImage src={cAvatar} />
                                    <AvatarFallback className="text-[8px]">
                                      {c.profiles?.full_name?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-bold dark:text-slate-200">{(c.profiles as any)?.full_name || 'User'}</span>
                                    {c.is_verified && <BadgeCheck className="w-3 h-3 text-primary shrink-0" />}
                                  </div>
                                </div>
                                <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                              </div>
                              <p className="text-sm pl-7 dark:text-slate-300">{c.comment}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="flex gap-2 pt-2 border-t dark:border-slate-800 mt-4">
                      <Input 
                        placeholder="Add a comment..." 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                        disabled={saving}
                        className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"
                      />
                      <Button onClick={handleAddComment} disabled={saving}>Post</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <TasksPageContent />
    </Suspense>
  );
}
