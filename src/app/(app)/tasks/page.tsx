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
  BadgeCheck,
  ArrowUpDown,
  LayoutGrid,
  List,
  LayoutList,
  ChevronRight,
  CheckSquare
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
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

const priorityRank: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
};

function TasksPageContent() {
  const { activeWorkspace, userProfile, userRole, hasPermission } = useWorkspace();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskAssignees, setTaskAssignees] = useState<Record<string, any[]>>({});
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
  const [createAssigneeIds, setCreateAssigneeIds] = useState<string[]>([]);

  const [view, setView] = useState("default");
  const [sortBy, setSortBy] = useState("created_at_desc");

  const [filters, setFilters] = useState({
    status: [] as string[],
    priority: [] as string[],
    teamId: "all",
    assignedTo: "all",
    overdue: false,
    dueSoon: false,
    createdByMe: false,
    assignedToMe: false,
    noDueDate: false,
    urgentOnly: false
  });

  const supabase = createClient();
  const { toast } = useToast();

  const forceUnlockUI = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = "";
      document.body.style.overflow = "";
    }
  }, []);

  useEffect(() => {
    return () => forceUnlockUI();
  }, [forceUnlockUI]);

  const canManageAssignees = useMemo(() => {
    return userRole === 'superadmin' || userRole === 'admin' || hasPermission('can_assign_tasks');
  }, [userRole, hasPermission]);

  const fetchData = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const [tasksRes, teamsRes, assigneesRes] = await Promise.all([
        supabase
          .from('my_tasks_view')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('sub_workspaces')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .order('name', { ascending: true }),
        supabase
          .from('task_assignees_view')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (teamsRes.error) throw teamsRes.error;
      if (assigneesRes.error) throw assigneesRes.error;

      const groupedAssignees: Record<string, any[]> = {};
      assigneesRes.data?.forEach(a => {
        if (!groupedAssignees[a.task_id]) groupedAssignees[a.task_id] = [];
        groupedAssignees[a.task_id].push(a);
      });
      setTaskAssignees(groupedAssignees);

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
          .select('id, full_name, username, avatar_url, avatar_preset')
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
      const enrichedComments = (c || []).map(comment => {
        const membership = members.find(m => m.user_id === comment.user_id);
        return { ...comment, is_verified: !!membership?.is_verified };
      });
      setSubtasks(st || []);
      setComments(enrichedComments);
      setActivityLogs(al || []);
      setAttachments(att || []);
    } catch (err: any) {}
  };

  const handleOpenDetail = (task: any) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
    fetchTaskDetails(task.id);
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const priority = (formData.get("priority") as string || "medium").toLowerCase();
    const dueDate = formData.get("due_date") as string;
    const subWsId = formData.get("sub_workspace_id") as string;
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
        progress_mode: 'auto',
        manual_progress: 0
      }).select().single();
      if (error) throw error;
      if (createAssigneeIds.length > 0) {
        await supabase.rpc("set_task_assignees", { p_task_id: createdTask.id, p_user_ids: createAssigneeIds });
      }
      toast({ title: "Success", description: "Task created successfully" });
      setIsCreateOpen(false);
      setCreateAssigneeIds([]);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
      forceUnlockUI();
    }
  };

  const handleUpdateAssignees = async (userIds: string[]) => {
    if (!selectedTask || !canManageAssignees) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("set_task_assignees", { p_task_id: selectedTask.id, p_user_ids: userIds });
      if (error) throw error;
      toast({ title: "Assignees updated" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    setSaving(true);
    try {
      const deletedTaskId = selectedTask.id;
      const { error } = await supabase.rpc('move_task_to_trash', { p_task_id: deletedTaskId });
      if (error) throw error;
      toast({ title: "Task moved to trash" });
      setIsDetailOpen(false);
      setTasks(prev => prev.filter(t => t.id !== deletedTaskId));
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
      forceUnlockUI();
    }
  };

  const handleToggleStatus = async (task: any, e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const newStatus = task.status === 'completed' ? 'to_do' : 'completed';
    const newProgress = newStatus === 'completed' ? 100 : task.manual_progress;
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus, manual_progress: newProgress }).eq('id', task.id);
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
      await supabase.from('task_comments').insert({ task_id: selectedTask.id, user_id: userProfile.id, comment: newComment });
      setNewComment("");
      fetchTaskDetails(selectedTask.id);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubtask = async () => {
    if (!selectedTask || !userProfile || !newSubtaskTitle.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('subtasks').insert({ task_id: selectedTask.id, title: newSubtaskTitle.trim(), created_by: userProfile.id, is_completed: false });
      if (error) throw error;
      setNewSubtaskTitle("");
      await fetchTaskDetails(selectedTask.id);
      await fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error adding subtask", description: err.message });
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
    } catch (err: any) {}
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
      const { error } = await supabase.from('tasks').update({ due_date: date || null }).eq('id', selectedTask.id);
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
      const { error } = await supabase.from('tasks').update({ sub_workspace_id: newTeamId }).eq('id', selectedTask.id);
      if (error) throw error;
      setSelectedTask({ ...selectedTask, sub_workspace_id: newTeamId });
      toast({ title: "Team assignment updated" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error updating team", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.is_deleted) return false;
      const assignees = taskAssignees[t.id] || [];
      const isAssigned = assignees.some(a => a.user_id === userProfile?.id);
      const isCreator = t.created_by === userProfile?.id;
      const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || t.description?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (filters.status.length > 0 && !filters.status.includes(t.status)) return false;
      if (filters.priority.length > 0 && !filters.priority.includes(t.priority)) return false;
      if (filters.teamId !== "all") {
        if (filters.teamId === "none" && t.sub_workspace_id) return false;
        if (filters.teamId !== "none" && t.sub_workspace_id !== filters.teamId) return false;
      }
      if (filters.assignedTo !== "all") { if (!assignees.some(a => a.user_id === filters.assignedTo)) return false; }
      const now = new Date();
      if (filters.overdue && (!t.due_date || new Date(t.due_date) > now || t.status === 'completed')) return false;
      if (filters.dueSoon) {
        if (!t.due_date) return false;
        const due = new Date(t.due_date);
        const soon = new Date();
        soon.setDate(soon.getDate() + 3);
        if (due > soon || due < now) return false;
      }
      if (filters.createdByMe && !isCreator) return false;
      if (filters.assignedToMe && !isAssigned) return false;
      if (filters.noDueDate && t.due_date) return false;
      if (filters.urgentOnly && t.priority !== 'urgent') return false;
      return true;
    });
  }, [tasks, searchTerm, filters, userProfile?.id, taskAssignees]);

  const sortedTasks = useMemo(() => {
    const t = [...filteredTasks];
    t.sort((a, b) => {
      switch (sortBy) {
        case "created_at_desc": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "created_at_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "due_date_asc": if (!a.due_date) return 1; if (!b.due_date) return -1; return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case "due_date_desc": if (!a.due_date) return 1; if (!b.due_date) return -1; return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
        case "priority_desc": return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
        case "priority_asc": return (priorityRank[a.priority] || 0) - (priorityRank[b.priority] || 0);
        case "progress_desc": { const pA = a.progress_mode === 'manual' ? (a.manual_progress || 0) : (a.calculated_progress || 0); const pB = b.progress_mode === 'manual' ? (b.manual_progress || 0) : (b.calculated_progress || 0); return pB - pA; }
        case "progress_asc": { const pA = a.progress_mode === 'manual' ? (a.manual_progress || 0) : (a.calculated_progress || 0); const pB = b.progress_mode === 'manual' ? (b.manual_progress || 0) : (b.calculated_progress || 0); return pA - pB; }
        case "title_asc": return a.title.localeCompare(b.title);
        case "title_desc": return b.title.localeCompare(a.title);
        default: return 0;
      }
    });
    return t;
  }, [filteredTasks, sortBy]);

  const timelineGroups = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const nextWeek = new Date(now); nextWeek.setDate(now.getDate() + 7);
    const groups = { overdue: [] as any[], today: [] as any[], tomorrow: [] as any[], thisWeek: [] as any[], later: [] as any[], noDate: [] as any[] };
    sortedTasks.forEach(t => {
      if (!t.due_date) { groups.noDate.push(t); return; }
      const d = new Date(t.due_date); d.setHours(0, 0, 0, 0);
      if (t.status !== 'completed' && d < now) groups.overdue.push(t);
      else if (d.getTime() === now.getTime()) groups.today.push(t);
      else if (d.getTime() === tomorrow.getTime()) groups.tomorrow.push(t);
      else if (d > tomorrow && d <= nextWeek) groups.thisWeek.push(t);
      else if (d > nextWeek) groups.later.push(t);
      else groups.noDate.push(t);
    });
    return groups;
  }, [sortedTasks]);

  const resetFilters = () => setFilters({ status: [], priority: [], teamId: "all", assignedTo: "all", overdue: false, dueSoon: false, createdByMe: false, assignedToMe: false, noDueDate: false, urgentOnly: false });

  const detailProgress = useMemo(() => {
    if (!selectedTask) return 0;
    if (selectedTask.progress_mode === 'manual') return selectedTask.manual_progress || 0;
    if (subtasks.length === 0) return 0;
    const completed = subtasks.filter(s => s.is_completed).length;
    return Math.round((completed / subtasks.length) * 100);
  }, [selectedTask, subtasks]);

  const selectedTaskAssignees = selectedTask ? (taskAssignees[selectedTask.id] || []) : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-slate-950 dark:text-slate-100">Tasks</h1><p className="text-muted-foreground">Manage and track your project assignments</p></div>
        <Button className="flex items-center gap-2 py-6 px-6 shadow-lg shadow-primary/20" onClick={() => { setCreateAssigneeIds([userProfile?.id].filter(Boolean)); setIsCreateOpen(true); }}><Plus className="w-5 h-5" /> New Task</Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border dark:border-slate-800">
          <div className="relative flex-1 w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-10 border-none shadow-none focus-visible:ring-0 dark:bg-slate-900 dark:text-slate-100" placeholder="Search tasks..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          <div className="flex items-center gap-2 w-full md:w-auto px-2">
             <DropdownMenu onOpenChange={() => forceUnlockUI()}>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="gap-2 border-none bg-slate-50 dark:bg-slate-800 dark:text-slate-300">{view === 'default' && <LayoutList className="w-4 h-4" />}{view === 'card' && <LayoutGrid className="w-4 h-4" />}{view === 'list' && <List className="w-4 h-4" />}{view === 'timeline' && <CalendarIcon className="w-4 h-4" />}<span className="hidden sm:inline capitalize">{view === 'default' ? 'Default' : `${view} view`}</span></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="dark:bg-slate-900 dark:border-slate-800"><DropdownMenuLabel className="dark:text-slate-100">View Mode</DropdownMenuLabel><DropdownMenuRadioGroup value={view} onValueChange={setView}><DropdownMenuRadioItem value="default" className="gap-2 dark:text-slate-300"><LayoutList className="w-4 h-4" /> Default View</DropdownMenuRadioItem><DropdownMenuRadioItem value="card" className="gap-2 dark:text-slate-300"><LayoutGrid className="w-4 h-4" /> Card View</DropdownMenuRadioItem><DropdownMenuRadioItem value="list" className="gap-2 dark:text-slate-300"><List className="w-4 h-4" /> List View</DropdownMenuRadioItem><DropdownMenuRadioItem value="timeline" className="gap-2 dark:text-slate-300"><CalendarIcon className="w-4 h-4" /> Timeline View</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuContent>
             </DropdownMenu>
             <DropdownMenu onOpenChange={() => forceUnlockUI()}>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="gap-2 border-none bg-slate-50 dark:bg-slate-800 dark:text-slate-300"><ArrowUpDown className="w-4 h-4" /><span className="hidden sm:inline">Sort</span></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 dark:bg-slate-900 dark:border-slate-800"><DropdownMenuLabel className="dark:text-slate-100">Sort By</DropdownMenuLabel><DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}><DropdownMenuRadioItem value="created_at_desc" className="dark:text-slate-300">Recently Created</DropdownMenuRadioItem><DropdownMenuRadioItem value="created_at_asc" className="dark:text-slate-300">Oldest Created</DropdownMenuRadioItem><DropdownMenuSeparator className="dark:bg-slate-800" /><DropdownMenuRadioItem value="due_date_asc" className="dark:text-slate-300">Due Date (Soonest)</DropdownMenuRadioItem><DropdownMenuRadioItem value="due_date_desc" className="dark:text-slate-300">Due Date (Latest)</DropdownMenuRadioItem><DropdownMenuSeparator className="dark:bg-slate-800" /><DropdownMenuRadioItem value="priority_desc" className="dark:text-slate-300">Priority (High-Low)</DropdownMenuRadioItem><DropdownMenuRadioItem value="priority_asc" className="dark:text-slate-300">Priority (Low-High)</DropdownMenuRadioItem><DropdownMenuSeparator className="dark:bg-slate-800" /><DropdownMenuRadioItem value="progress_desc" className="dark:text-slate-300">Progress (High-Low)</DropdownMenuRadioItem><DropdownMenuRadioItem value="progress_asc" className="dark:text-slate-300">Progress (Low-High)</DropdownMenuRadioItem><DropdownMenuSeparator className="dark:bg-slate-800" /><DropdownMenuRadioItem value="title_asc" className="dark:text-slate-300">Title (A-Z)</DropdownMenuRadioItem><DropdownMenuRadioItem value="title_desc" className="dark:text-slate-300">Title (Z-A)</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuContent>
             </DropdownMenu>
             <DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="gap-2 border-none bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-100"><Filter className="w-4 h-4" /> Filters</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 dark:bg-slate-900 dark:border-slate-800"><DropdownMenuLabel className="dark:text-slate-100">Status</DropdownMenuLabel>{['to_do', 'in_progress', 'completed', 'waiting'].map(s => (<DropdownMenuCheckboxItem key={s} checked={filters.status.includes(s)} onCheckedChange={(checked) => setFilters(f => ({ ...f, status: checked ? [...f.status, s] : f.status.filter(x => x !== s) }))} className="capitalize dark:text-slate-300">{s.replace('_', ' ')}</DropdownMenuCheckboxItem>))}<DropdownMenuSeparator className="dark:bg-slate-800" /><DropdownMenuLabel className="dark:text-slate-100">Priority</DropdownMenuLabel>{['low', 'medium', 'high', 'urgent'].map(p => (<DropdownMenuCheckboxItem key={p} checked={filters.priority.includes(p)} onCheckedChange={(checked) => setFilters(f => ({ ...f, priority: checked ? [...f.priority, p] : f.priority.filter(x => x !== p) }))} className="capitalize dark:text-slate-300">{p}</DropdownMenuCheckboxItem>))}<DropdownMenuSeparator className="dark:bg-slate-800" /><DropdownMenuLabel className="dark:text-slate-100">Assignment</DropdownMenuLabel><DropdownMenuCheckboxItem checked={filters.assignedToMe} onCheckedChange={v => setFilters(f => ({...f, assignedToMe: v}))} className="dark:text-slate-300">Assigned to Me</DropdownMenuCheckboxItem><DropdownMenuCheckboxItem checked={filters.createdByMe} onCheckedChange={v => setFilters(f => ({...f, createdByMe: v}))} className="dark:text-slate-300">Created by Me</DropdownMenuCheckboxItem><DropdownMenuSeparator className="dark:bg-slate-800" /><DropdownMenuItem onClick={resetFilters} className="text-rose-500 gap-2 dark:hover:bg-rose-500/10"><FilterX className="w-4 h-4" /> Reset Filters</DropdownMenuItem></DropdownMenuContent>
             </DropdownMenu>
             <Separator orientation="vertical" className="h-6 mx-2 hidden md:block dark:bg-slate-800" /><Select value={filters.teamId} onValueChange={(v) => setFilters(f => ({...f, teamId: v}))}><SelectTrigger className="w-[140px] border-none shadow-none bg-slate-50 dark:bg-slate-800 text-xs h-8 rounded-lg dark:text-slate-100"><Layout className="w-3 h-3 mr-2" /><SelectValue placeholder="Team" /></SelectTrigger><SelectContent className="dark:bg-slate-900 dark:border-slate-800"><SelectItem value="all">All Teams</SelectItem><SelectItem value="none">No Team</SelectItem>{subWorkspaces.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2"><Button variant="secondary" size="sm" className={cn("rounded-full text-[10px] h-7 px-4 font-bold uppercase tracking-wider transition-all", filters.assignedToMe ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700")} onClick={() => setFilters(f => ({...f, assignedToMe: !f.assignedToMe}))}><UserCheck className="w-3 h-3 mr-1.5" /> Assigned to Me</Button><Button variant="secondary" size="sm" className={cn("rounded-full text-[10px] h-7 px-4 font-bold uppercase tracking-wider transition-all", filters.overdue ? "bg-rose-600 text-white hover:bg-rose-700 shadow-md" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700")} onClick={() => setFilters(f => ({...f, overdue: !f.overdue}))}><AlertCircle className="w-3 h-3 mr-1.5" /> Overdue</Button><Button variant="secondary" size="sm" className={cn("rounded-full text-[10px] h-7 px-4 font-bold uppercase tracking-wider transition-all", filters.dueSoon ? "bg-amber-600 text-white hover:bg-amber-700 shadow-md" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700")} onClick={() => setFilters(f => ({...f, dueSoon: !f.dueSoon}))}><Clock className="w-3 h-3 mr-1.5" /> Due Soon</Button><Button variant="secondary" size="sm" className={cn("rounded-full text-[10px] h-7 px-4 font-bold uppercase tracking-wider transition-all", filters.urgentOnly ? "bg-rose-500 text-white hover:bg-rose-600 shadow-md" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700")} onClick={() => setFilters(f => ({...f, urgentOnly: !f.urgentOnly}))}><AlertCircle className="w-3 h-3 mr-1.5" /> Urgent</Button><Button variant="secondary" size="sm" className={cn("rounded-full text-[10px] h-7 px-4 font-bold uppercase tracking-wider transition-all", filters.noDueDate ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700")} onClick={() => setFilters(f => ({...f, noDueDate: !f.noDueDate}))}>No Due Date</Button><Button variant="secondary" size="sm" className={cn("rounded-full text-[10px] h-7 px-4 font-bold uppercase tracking-wider transition-all", filters.status.includes('completed') ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700")} onClick={() => setFilters(f => ({...f, status: f.status.includes('completed') ? f.status.filter(x => x !== 'completed') : [...f.status, 'completed']}))}><CheckCircle2 className="w-3 h-3 mr-1.5" /> Completed</Button></div>
      </div>

      <div className="min-h-[50vh]">{loading && !saving ? (<div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>) : sortedTasks.length === 0 ? (<div className="text-center py-24 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4"><div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm border dark:border-slate-800"><Ban className="w-10 h-10 text-slate-200 dark:text-slate-700" /></div><div className="space-y-1"><p className="font-bold text-xl text-slate-900 dark:text-slate-100">No tasks matched your criteria</p><p className="text-muted-foreground text-sm max-w-sm mx-auto">Try clearing some filters or adjusting your search term to see more results.</p></div><Button variant="outline" onClick={resetFilters} className="dark:border-slate-800 rounded-xl mt-2">Clear All Filters</Button></div>) : (<div className="space-y-8">{view === 'timeline' ? (<TimelineView groups={timelineGroups} assignees={taskAssignees} onOpenDetail={handleOpenDetail} onToggleStatus={handleToggleStatus} />) : view === 'card' ? (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{sortedTasks.map(t => <TaskCardView key={t.id} task={t} assignees={taskAssignees[t.id] || []} onOpenDetail={handleOpenDetail} onToggleStatus={handleToggleStatus} />)}</div>) : view === 'list' ? (<div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 overflow-hidden shadow-sm"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-950/50 border-b dark:border-slate-800"><tr><th className="text-left p-4 font-bold uppercase tracking-wider text-muted-foreground text-[10px]">Status</th><th className="text-left p-4 font-bold uppercase tracking-wider text-muted-foreground text-[10px]">Task Name</th><th className="text-left p-4 font-bold uppercase tracking-wider text-muted-foreground text-[10px] hidden md:table-cell">Team</th><th className="text-left p-4 font-bold uppercase tracking-wider text-muted-foreground text-[10px] hidden lg:table-cell">Priority</th><th className="text-left p-4 font-bold uppercase tracking-wider text-muted-foreground text-[10px]">Assignees</th><th className="text-left p-4 font-bold uppercase tracking-wider text-muted-foreground text-[10px]">Due Date</th><th className="text-right p-4 font-bold uppercase tracking-wider text-muted-foreground text-[10px]">Progress</th></tr></thead><tbody className="divide-y dark:divide-slate-800">{sortedTasks.map(t => <TaskRowView key={t.id} task={t} assignees={taskAssignees[t.id] || []} onOpenDetail={handleOpenDetail} onToggleStatus={handleToggleStatus} />)}</tbody></table></div></div>) : (<div className="grid grid-cols-1 gap-4">{sortedTasks.map((task) => (<TaskDefaultView key={task.id} task={task} assignees={taskAssignees[task.id] || []} onOpenDetail={handleOpenDetail} onToggleStatus={handleToggleStatus} />))}</div>)}</div>)}</div>

      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) forceUnlockUI(); }}>
        <DialogContent className="max-w-md dark:bg-slate-950 dark:border-slate-800"><DialogHeader><DialogTitle className="dark:text-slate-100">Create New Task</DialogTitle><DialogDescription>Add a new assignment to {activeWorkspace?.name}</DialogDescription></DialogHeader><form onSubmit={handleCreateTask} className="space-y-4 py-4"><div className="space-y-2"><Label htmlFor="title" className="dark:text-slate-300">Task Title</Label><Input id="title" name="title" placeholder="What needs to be done?" required disabled={saving} className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100" /></div><div className="space-y-2"><Label htmlFor="description" className="dark:text-slate-300">Description</Label><Textarea id="description" name="description" placeholder="Add more details..." disabled={saving} className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100" /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="sub_workspace_id" className="dark:text-slate-300">Assign to Team</Label><Select name="sub_workspace_id" defaultValue="none"><SelectTrigger disabled={saving} className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="dark:bg-slate-900 dark:border-slate-800"><SelectItem value="none">Workspace General</SelectItem>{subWorkspaces.map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label className="dark:text-slate-300">Assign Members</Label><AssigneePicker members={members} selectedIds={createAssigneeIds} onToggle={(id: string) => setCreateAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} disabled={saving} /></div></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="priority" className="dark:text-slate-300">Priority</Label><Select name="priority" defaultValue="medium"><SelectTrigger disabled={saving} className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="dark:bg-slate-900 dark:border-slate-800"><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="due_date" className="dark:text-slate-300">Due Date</Label><Input id="due_date" name="due_date" type="date" disabled={saving} className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100" /></div></div><DialogFooter className="pt-4"><Button type="button" variant="ghost" onClick={() => { setIsCreateOpen(false); forceUnlockUI(); }} disabled={saving} className="dark:text-slate-300 dark:hover:bg-slate-800">Cancel</Button><Button type="submit" disabled={saving} className="shadow-lg shadow-primary/20">{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Create Task</Button></DialogFooter></form></DialogContent>
      </Dialog>

      <Sheet open={isDetailOpen} onOpenChange={(open) => { setIsDetailOpen(open); if (!open) forceUnlockUI(); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto dark:bg-slate-950 dark:border-slate-800">{selectedTask && (<div className="space-y-8 pt-6"><SheetHeader><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2 flex-wrap"><Badge variant="outline" className="capitalize dark:border-slate-800 dark:text-slate-400">{selectedTask.priority}</Badge><Badge variant="secondary" className="capitalize dark:bg-slate-900 dark:text-slate-300">{selectedTask.status?.replace('_', ' ')}</Badge></div><Button variant="ghost" size="icon" className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" onClick={handleDeleteTask} disabled={saving}><Trash2 className="w-5 h-5" /></Button></div><div className="flex items-start justify-between gap-4"><div className="space-y-1"><SheetTitle className={cn("text-2xl font-bold dark:text-slate-100", selectedTask.status === 'completed' && "line-through text-muted-foreground")}>{selectedTask.title}</SheetTitle><SheetDescription className="dark:text-slate-400">{selectedTask.description || 'No description provided.'}</SheetDescription></div><Button variant={selectedTask.status === 'completed' ? "outline" : "default"} size="sm" className="shrink-0 gap-2 dark:border-slate-800" onClick={() => handleToggleStatus(selectedTask)}>{selectedTask.status === 'completed' ? <>Reopen Task</> : <><Check className="w-4 h-4" /> Mark Complete</>}</Button></div></SheetHeader><div className="space-y-6"><div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-800"><div className="space-y-1.5"><Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><CalendarDays className="w-3 h-3" /> Due Date</Label><Input type="date" value={selectedTask.due_date ? selectedTask.due_date.split('T')[0] : ''} onChange={(e) => handleUpdateDueDate(e.target.value)} className="h-9 text-sm bg-white dark:bg-slate-950 dark:text-slate-100" disabled={saving} /></div><div className="space-y-1.5"><Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><User className="w-3 h-3" /> Assignees</Label><AssigneePicker members={members} selectedIds={selectedTaskAssignees.map(a => a.user_id)} onToggle={(id: string) => { const current = selectedTaskAssignees.map(a => a.user_id); const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]; handleUpdateAssignees(next); }} disabled={saving || !canManageAssignees} variant="compact" /></div></div><div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-800"><div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Layout className="w-3 h-3" /> Team Assignment</Label><Select value={selectedTask.sub_workspace_id || "none"} onValueChange={handleUpdateTeam} disabled={saving}><SelectTrigger className="h-9 bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger><SelectContent className="dark:bg-slate-900 dark:border-slate-800"><SelectItem value="none">General (No Team)</SelectItem>{subWorkspaces.map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Settings2 className="w-3 h-3" /> Progress Mode</Label><Select value={selectedTask.progress_mode} onValueChange={(v: any) => handleSwitchProgressMode(v)}><SelectTrigger className="h-9 bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger><SelectContent className="dark:bg-slate-900 dark:border-slate-800"><SelectItem value="auto">Auto (Subtasks)</SelectItem><SelectItem value="manual">Manual Slider</SelectItem></SelectContent></Select></div></div><div className="mt-6">{selectedTask.progress_mode === 'manual' ? (<div className="space-y-4"><Slider value={[selectedTask.manual_progress || 0]} onValueChange={handleUpdateManualProgress} max={100} step={1} disabled={saving || selectedTask.status === 'completed'} /><p className="text-xs text-center font-bold text-primary">{selectedTask.manual_progress}% Complete</p></div>) : (<div className="space-y-2"><Progress value={detailProgress} className="h-2" /><div className="flex justify-between items-center text-[10px] font-bold text-primary uppercase"><span>Auto Mode</span><span>{detailProgress}% Complete</span></div></div>)}</div></div><div className="space-y-4"><h4 className="font-bold flex items-center gap-2 dark:text-slate-100"><CheckCircle2 className="w-4 h-4 text-primary" /> Subtasks</h4><div className="space-y-2">{subtasks.map((st) => (<div key={st.id} className="flex items-center justify-between group p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-colors"><div className="flex items-center gap-3"><input type="checkbox" checked={st.is_completed} onChange={() => handleToggleSubtask(st)} className="w-4 h-4 rounded border-slate-300 dark:border-slate-800 text-primary" disabled={saving} /><span className={cn("text-sm dark:text-slate-300", st.is_completed && "line-through text-muted-foreground")}>{st.title}</span></div></div>))}<div className="flex items-center gap-2 mt-2"><Input placeholder="Add subtask..." value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()} className="h-9 text-sm dark:bg-slate-900 dark:border-slate-800" disabled={saving} /></div></div></div><div className="space-y-4"><h4 className="font-bold flex items-center gap-2 dark:text-slate-100"><MessageSquare className="w-4 h-4 text-primary" /> Comments</h4><div className="space-y-4"><div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">{comments.length === 0 ? <p className="text-sm text-muted-foreground italic">No comments yet.</p> : comments.map((c) => (<div key={c.id} className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg space-y-2"><div className="flex justify-between items-center"><div className="flex items-center gap-2"><Avatar className="w-5 h-5 border dark:border-slate-800"><AvatarImage src={c.profiles?.avatar_preset ? `/avatars/${c.profiles.avatar_preset}.png` : c.profiles?.avatar_url} /><AvatarFallback className="text-[8px]">{c.profiles?.full_name?.[0]}</AvatarFallback></Avatar><div className="flex items-center gap-1"><span className="text-xs font-bold dark:text-slate-200">{(c.profiles as any)?.full_name || 'User'}</span>{c.is_verified && <BadgeCheck className="w-3 h-3 text-primary shrink-0" />}</div></div><span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span></div><p className="text-sm pl-7 dark:text-slate-300">{c.comment}</p></div>))}</div><div className="flex gap-2 pt-2 border-t dark:border-slate-800 mt-4"><Input placeholder="Add a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} disabled={saving} className="dark:bg-slate-900 dark:border-slate-800" /><Button onClick={handleAddComment} disabled={saving}>Post</Button></div></div></div></div></div>)}</SheetContent>
      </Sheet>
    </div>
  );
}

function AssigneePicker({ members, selectedIds, onToggle, disabled, variant = "default" }: any) {
  const selectedMembers = members.filter((m: any) => selectedIds.includes(m.user_id));
  return (
    <Popover onOpenChange={(open) => !open && (typeof document !== 'undefined' ? (document.body.style.pointerEvents = "") : null)}>
      <PopoverTrigger asChild><Button variant="outline" size={variant === 'compact' ? 'sm' : 'default'} className={cn("w-full justify-between gap-2 bg-white dark:bg-slate-900 dark:border-slate-800 h-9", variant === 'compact' ? 'px-2' : '')} disabled={disabled}><div className="flex items-center gap-2 overflow-hidden">{selectedMembers.length === 0 ? (<span className="text-muted-foreground text-xs">Unassigned</span>) : (<div className="flex -space-x-1.5 overflow-hidden">{selectedMembers.slice(0, 3).map((m: any) => (<Avatar key={m.user_id} className="w-5 h-5 border-2 border-white dark:border-slate-900 shrink-0"><AvatarImage src={m.profiles?.avatar_preset ? `/avatars/${m.profiles.avatar_preset}.png` : m.profiles?.avatar_url} /><AvatarFallback className="text-[8px] bg-primary/5 text-primary">{m.profiles?.full_name?.[0]}</AvatarFallback></Avatar>))}{selectedMembers.length > 3 && (<div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-bold text-muted-foreground">+{selectedMembers.length - 3}</div>)}</div>)}<span className="truncate text-xs font-medium">{selectedMembers.length === 1 ? selectedMembers[0].profiles?.full_name : selectedMembers.length > 1 ? `${selectedMembers.length} assigned` : ''}</span></div><UserPlus className="w-3.5 h-3.5 shrink-0 opacity-50" /></Button></PopoverTrigger>
      <PopoverContent className="w-64 p-0 dark:bg-slate-950 dark:border-slate-800 z-[100] pointer-events-auto" align="start"><ScrollArea className="h-64"><div className="p-2 space-y-1">{members.map((m: any) => (<div key={m.user_id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg cursor-pointer transition-colors pointer-events-auto" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(m.user_id); }}><Checkbox checked={selectedIds.includes(m.user_id)} className="shrink-0 pointer-events-none" /><Avatar className="w-6 h-6 border dark:border-slate-800"><AvatarImage src={m.profiles?.avatar_preset ? `/avatars/${m.profiles.avatar_preset}.png` : m.profiles?.avatar_url} /><AvatarFallback className="text-[8px]">{m.profiles?.full_name?.[0]}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="text-xs font-bold truncate dark:text-slate-200">{m.profiles?.full_name}</p><p className="text-[10px] text-muted-foreground truncate italic">@{m.profiles?.username}</p></div>{m.is_verified && <BadgeCheck className="w-3 h-3 text-primary shrink-0" />}</div>))}</div></ScrollArea></PopoverContent>
    </Popover>
  );
}

function AssigneeAvatars({ assignees }: { assignees: any[] }) {
  if (!assignees || assignees.length === 0) return (<div className="flex items-center gap-2 text-muted-foreground italic text-xs"><User className="w-3.5 h-3.5" /> Unassigned</div>);
  return (<div className="flex items-center gap-2"><div className="flex -space-x-2 overflow-hidden">{assignees.slice(0, 3).map((a) => (<Avatar key={a.user_id} className="w-6 h-6 border-2 border-white dark:border-slate-900 shadow-sm shrink-0"><AvatarImage src={a.avatar_preset ? `/avatars/${a.avatar_preset}.png` : a.avatar_url} /><AvatarFallback className="bg-primary/5 text-primary text-[8px] font-bold">{a.full_name?.[0]}</AvatarFallback></Avatar>))}{assignees.length > 3 && (<div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-bold text-muted-foreground shadow-sm">+{assignees.length - 3}</div>)}</div><span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{assignees.length === 1 ? assignees[0].full_name : `${assignees.length} members`}</span></div>);
}

function TaskDefaultView({ task, assignees, onOpenDetail, onToggleStatus }: any) {
  const taskProgress = task.progress_mode === 'manual' ? (task.manual_progress || 0) : (task.calculated_progress || 0);
  return (<Card className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden cursor-pointer dark:bg-slate-900" onClick={() => onOpenDetail(task)}><CardContent className="p-0"><div className="flex flex-col md:flex-row"><div className={cn("w-full md:w-1.5 h-1.5 md:h-auto", task.priority?.toLowerCase() === 'urgent' ? "bg-rose-500" : task.priority?.toLowerCase() === 'high' ? "bg-amber-500" : "bg-primary")} /><div className="flex-1 p-6 flex flex-col md:flex-row md:items-center gap-6"><div className="flex items-center gap-4 shrink-0"><button onClick={(e) => onToggleStatus(task, e)} className="hover:scale-110 transition-transform">{task.status === 'completed' ? (<CheckCircle2 className="w-6 h-6 text-emerald-500 fill-emerald-50 dark:fill-emerald-500/10" />) : (<Circle className="w-6 h-6 text-slate-300 dark:text-slate-700" />)}</button></div><div className="flex-1 space-y-1"><div className="flex items-center gap-2 flex-wrap"><h3 className={cn("font-bold text-lg group-hover:text-primary transition-colors first-letter:capitalize dark:text-slate-100", task.status === 'completed' && "line-through text-muted-foreground")}>{task.title}</h3><Badge variant="outline" className="text-[10px] rounded-sm capitalize border-slate-200 dark:border-slate-800 dark:text-slate-400">{task.priority}</Badge>{task.sub_workspace_name && (<Badge variant="secondary" className="text-[10px] bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-none"><Layout className="w-2.5 h-2.5 mr-1" /> {task.sub_workspace_name}</Badge>)}</div><p className="text-sm text-muted-foreground line-clamp-1">{task.description || 'No description'}</p></div><div className="flex items-center gap-8 min-w-[300px]"><div className="space-y-1"><p className={cn("text-xs font-medium flex items-center gap-1", task.is_overdue ? "text-rose-500 font-bold" : "text-muted-foreground")}><CalendarIcon className="w-3 h-3" /> {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}</p><AssigneeAvatars assignees={assignees} /></div><div className="flex-1"><div className="flex justify-between items-center mb-1.5"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Progress</span><span className="text-xs font-bold text-primary">{Math.round(taskProgress)}%</span></div><Progress value={taskProgress} className="h-1.5" /></div></div></div></div></CardContent></Card>);
}

function TaskCardView({ task, assignees, onOpenDetail, onToggleStatus }: any) {
  const taskProgress = task.progress_mode === 'manual' ? (task.manual_progress || 0) : (task.calculated_progress || 0);
  return (<Card className="border-none shadow-sm hover:shadow-md transition-all group cursor-pointer dark:bg-slate-900 flex flex-col h-full" onClick={() => onOpenDetail(task)}><div className={cn("h-1.5 w-full", task.priority?.toLowerCase() === 'urgent' ? "bg-rose-500" : task.priority?.toLowerCase() === 'high' ? "bg-amber-500" : "bg-primary")} /><CardContent className="p-5 flex-1 flex flex-col space-y-4"><div className="flex items-start justify-between gap-4"><button onClick={(e) => onToggleStatus(task, e)} className="mt-1 shrink-0">{task.status === 'completed' ? (<CheckCircle2 className="w-5 h-5 text-emerald-500" />) : (<Circle className="w-5 h-5 text-slate-300 dark:text-slate-700" />)}</button><div className="flex-1 min-w-0"><h3 className={cn("font-bold text-sm line-clamp-2 dark:text-slate-100", task.status === 'completed' && "line-through text-muted-foreground")}>{task.title}</h3></div></div><p className="text-xs text-muted-foreground line-clamp-2 flex-1">{task.description || 'No description provided.'}</p><div className="flex items-center justify-between gap-2 flex-wrap"><Badge variant="outline" className="text-[9px] h-4 py-0 dark:border-slate-800 dark:text-slate-400 capitalize">{task.priority}</Badge>{task.sub_workspace_name && <Badge variant="secondary" className="text-[9px] h-4 py-0 border-none bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400">{task.sub_workspace_name}</Badge>}</div><div className="space-y-3 pt-2"><div className="flex items-center justify-between text-[10px]"><span className={cn("flex items-center gap-1 font-bold uppercase", task.is_overdue ? "text-rose-500" : "text-slate-400")}><CalendarIcon className="w-3 h-3" />{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}</span><AssigneeAvatars assignees={assignees} /></div><div className="space-y-1.5"><div className="flex justify-between items-center text-[10px] font-bold text-primary uppercase"><span>Progress</span><span>{Math.round(taskProgress)}%</span></div><Progress value={taskProgress} className="h-1" /></div></div></CardContent></Card>);
}

function TaskRowView({ task, assignees, onOpenDetail, onToggleStatus }: any) {
  const taskProgress = task.progress_mode === 'manual' ? (task.manual_progress || 0) : (task.calculated_progress || 0);
  return (<tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group" onClick={() => onOpenDetail(task)}><td className="p-4 w-12"><button onClick={(e) => onToggleStatus(task, e)}>{task.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-slate-300 dark:text-slate-700" />}</button></td><td className="p-4 min-w-[200px]"><div className="flex items-center gap-2"><span className={cn("font-bold text-sm dark:text-slate-200", task.status === 'completed' && "line-through text-muted-foreground")}>{task.title}</span>{task.is_overdue && <Badge variant="destructive" className="text-[8px] h-3.5 px-1 uppercase">Late</Badge>}</div></td><td className="p-4 hidden md:table-cell">{task.sub_workspace_name ? <Badge variant="secondary" className="text-[9px] bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-none">{task.sub_workspace_name}</Badge> : <span className="text-slate-300 dark:text-slate-700">None</span>}</td><td className="p-4 hidden lg:table-cell"><Badge variant="outline" className={cn("text-[9px] uppercase", task.priority === 'urgent' ? "border-rose-500 text-rose-500" : "dark:border-slate-800 dark:text-slate-400")}>{task.priority}</Badge></td><td className="p-4"><AssigneeAvatars assignees={assignees} /></td><td className="p-4 whitespace-nowrap"><span className={cn("text-xs font-medium", task.is_overdue ? "text-rose-500" : "text-muted-foreground")}>{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}</span></td><td className="p-4 text-right"><div className="flex items-center justify-end gap-2"><span className="text-xs font-bold text-primary">{Math.round(taskProgress)}%</span><Progress value={taskProgress} className="w-12 h-1" /></div></td></tr>);
}

function TimelineView({ groups, assignees, onOpenDetail, onToggleStatus }: any) {
  const sections = [ { id: 'overdue', label: 'Overdue', tasks: groups.overdue, color: 'text-rose-500' }, { id: 'today', label: 'Today', tasks: groups.today, color: 'text-blue-500' }, { id: 'tomorrow', label: 'Tomorrow', tasks: groups.tomorrow, color: 'text-indigo-500' }, { id: 'thisWeek', label: 'This Week', tasks: groups.thisWeek, color: 'text-violet-500' }, { id: 'later', label: 'Later', tasks: groups.later, color: 'text-slate-500' }, { id: 'noDate', label: 'No Due Date', tasks: groups.noDate, color: 'text-slate-400' } ];
  return (<div className="space-y-12">{sections.map(section => section.tasks.length > 0 && (<div key={section.id} className="space-y-4"><div className="flex items-center gap-3"><h2 className={cn("text-lg font-bold flex items-center gap-2", section.color)}>{section.label}<span className="text-xs font-normal text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{section.tasks.length}</span></h2><Separator className="flex-1 opacity-50 dark:bg-slate-800" /></div><div className="grid grid-cols-1 gap-3">{section.tasks.map(t => <TaskDefaultView key={t.id} task={t} assignees={assignees[t.id] || []} onOpenDetail={onOpenDetail} onToggleStatus={onToggleStatus} />)}</div></div>))}</div>);
}

export default function TasksPage() {
  return (<Suspense fallback={<div className="flex h-[50vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}><TasksPageContent /></Suspense>);
}
