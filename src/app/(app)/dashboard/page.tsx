"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  ArrowRight,
  Loader2,
  Bell,
  CheckCircle,
  Calendar as CalendarIcon,
  Plus,
  MessageSquare,
  StickyNote,
  Users,
  RefreshCw,
  Zap,
  CalendarDays,
  CheckSquare,
  Trash2,
  Paperclip,
  BadgeCheck,
  PlaneTakeoff,
  History,
  XCircle,
  Shield,
  MoreHorizontal,
  UserPlus,
  Mail,
  ExternalLink,
  Layout,
  Palmtree,
  Circle
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";

const activityConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  task_created: { label: "created a task", icon: CheckSquare, color: "text-blue-500", bg: "bg-blue-500" },
  task_updated: { label: "updated a task", icon: RefreshCw, color: "text-slate-500", bg: "bg-slate-500" },
  task_status_changed: { label: "changed task status", icon: RefreshCw, color: "text-blue-400", bg: "bg-blue-400" },
  status_changed: { label: "changed task status", icon: RefreshCw, color: "text-blue-400", bg: "bg-blue-400" },
  task_completed: { label: "completed a task", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500" },
  task_cancelled: { label: "cancelled a task", icon: XCircle, color: "text-rose-400", bg: "bg-rose-400" },
  task_priority_changed: { label: "changed priority", icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-500" },
  task_assigned: { label: "assigned a task", icon: UserPlus, color: "text-indigo-500", bg: "bg-indigo-500" },
  assignee_changed: { label: "changed assignee", icon: UserPlus, color: "text-indigo-500", bg: "bg-indigo-500" },
  task_due_date_changed: { label: "changed due date", icon: CalendarIcon, color: "text-violet-500", bg: "bg-violet-500" },
  task_deleted: { label: "deleted a task", icon: Trash2, color: "text-rose-500", bg: "bg-rose-500" },
  task_restored: { label: "restored a task", icon: RefreshCw, color: "text-emerald-500", bg: "bg-emerald-500" },
  subtask_created: { label: "added a subtask", icon: CheckSquare, color: "text-blue-300", bg: "bg-blue-300" },
  subtask_completed: { label: "completed a subtask", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400" },
  subtask_reopened: { label: "reopened a subtask", icon: Circle, color: "text-slate-400", bg: "bg-slate-400" },
  task_comment_added: { label: "commented on a task", icon: MessageSquare, color: "text-indigo-500", bg: "bg-indigo-500" },
  progress_updated: { label: "updated progress", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500" },
  attachment_uploaded: { label: "attached a file", icon: Paperclip, color: "text-slate-500", bg: "bg-slate-500" },
  note_created: { label: "created a note", icon: StickyNote, color: "text-amber-500", bg: "bg-amber-500" },
  note_updated: { label: "updated a note", icon: StickyNote, color: "text-amber-600", bg: "bg-amber-600" },
};

export default function DashboardPage() {
  const { activeWorkspace, userProfile, userRole, hasPermission } = useWorkspace();
  const [stats, setStats] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [workload, setWorkload] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]); 
  const [teamPresence, setTeamPresence] = useState<any[]>([]); 
  const [leaveApprovals, setLeaveApprovals] = useState<any[]>([]); 
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [newReminder, setNewReminder] = useState({ title: "", remindAt: "" });

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingLeave, setReviewingLeave] = useState<any>(null);
  const [reviewForm, setReviewForm] = useState({ status: "" as "approved" | "rejected", reason: "" });
  
  const supabase = createClient();
  const { toast } = useToast();
  const router = useRouter();

  const forceUnlockUI = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = "auto";
      document.body.style.overflow = "auto";
      setTimeout(() => {
        document.body.style.pointerEvents = "";
        document.body.style.overflow = "";
      }, 300);
    }
  }, []);

  useEffect(() => {
    return () => forceUnlockUI();
  }, [forceUnlockUI]);

  const fetchDashboardData = useCallback(async () => {
    if (!activeWorkspace || !userProfile) return;
    setLoading(true);
    try {
      const [tasksRes, activityRes, notifsRes, remindersRes, workloadRes, leavesRes, membersRes] = await Promise.all([
        supabase.from('my_tasks_view').select('id, title, status, priority, due_date, is_overdue, progress_mode, manual_progress, calculated_progress').eq('workspace_id', activeWorkspace.id).eq('is_deleted', false).order('due_date', { ascending: true }),
        supabase.rpc('get_recent_workspace_activity', { p_workspace_id: activeWorkspace.id, p_limit: 20 }),
        supabase.from('notifications').select('id, title, message, type, is_read, created_at, related_app_update_id, related_task_id, related_note_id, related_message_id').eq('user_id', userProfile.id).eq('is_read', false).eq('is_deleted', false).order('created_at', { ascending: false }).limit(5),
        supabase.from('reminders').select('id, title, remind_at').eq('remind_to', userProfile.id).eq('is_completed', false).order('remind_at', { ascending: true }).limit(5),
        supabase.from('member_workload_view').select('full_name, active_tasks, completed_tasks, overdue_tasks').eq('workspace_id', activeWorkspace.id).order('active_tasks', { ascending: false }),
        supabase.from('leave_requests_view').select('*').eq('workspace_id', activeWorkspace.id).order('start_date', { ascending: true }),
        supabase.from('workspace_members').select('user_id, role, is_verified, profiles:user_id(full_name, avatar_url, avatar_preset, email)').eq('workspace_id', activeWorkspace.id).eq('status', 'active').limit(12)
      ]);

      if (activityRes.error) {
        console.error("[Dashboard] Activity Fetch Failed:", {
          message: activityRes.error.message,
          details: activityRes.error.details,
          hint: activityRes.error.hint,
          code: activityRes.error.code
        });
      }

      const myTasks = tasksRes.data || [];
      const activeTasks = myTasks.filter(t => t.status !== 'completed');
      const completedTasks = myTasks.filter(t => t.status === 'completed');
      const overdueTasks = myTasks.filter(t => t.is_overdue && t.status !== 'completed');
      const dueSoonTasks = myTasks.filter(t => {
        if (!t.due_date || t.status === 'completed') return false;
        const due = new Date(t.due_date);
        const soon = new Date(); soon.setDate(soon.getDate() + 3);
        return due <= soon && due >= new Date();
      });

      setStats([
        { label: "Active", count: activeTasks.length, icon: Clock, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
        { label: "Due Soon", count: dueSoonTasks.length, icon: CalendarDays, color: "text-amber-500", bg: "bg-amber-500/10" },
        { label: "Overdue", count: overdueTasks.length, icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-500/10" },
        { label: "Completed", count: completedTasks.length, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
      ]);

      setTasks(myTasks); 
      setActivity(activityRes.data || []); 
      setNotifications(notifsRes.data || []); 
      setReminders(remindersRes.data || []); 
      setWorkload(workloadRes.data || []); 
      setMembers(membersRes.data || []);

      const allLeaves = leavesRes.data || [];
      setLeaveRequests(allLeaves.filter(l => l.user_id === userProfile.id));
      setTeamPresence(allLeaves.filter(l => l.status === 'approved' && new Date(l.return_date) >= new Date()));
      
      if (userRole === 'superadmin' || userRole === 'admin' || hasPermission('approve_leave_requests')) {
        setLeaveApprovals(allLeaves.filter(l => l.status === 'pending' && l.user_id !== userProfile.id));
      }
    } catch (err) {} finally { setLoading(false); }
  }, [activeWorkspace, userProfile, userRole, hasPermission, supabase]);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const handleRunNotificationChecks = async () => {
    if (!activeWorkspace) return;
    setIsRunningChecks(true);
    try {
      const response = await fetch("/api/admin/run-notification-checks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: activeWorkspace.id }), });
      if (!response.ok) throw new Error("Check failed");
      toast({ title: "Checks completed" });
      fetchDashboardData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsRunningChecks(false);
      forceUnlockUI();
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !userProfile) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('reminders').insert({ workspace_id: activeWorkspace.id, created_by: userProfile.id, remind_to: userProfile.id, title: newReminder.title, remind_at: new Date(newReminder.remindAt).toISOString() });
      if (error) throw error;
      toast({ title: "Reminder set!" });
      setIsReminderModalOpen(false);
      setNewReminder({ title: "", remindAt: "" });
      fetchDashboardData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
      forceUnlockUI();
    }
  };

  const handleCompleteReminder = async (id: string) => {
    try {
      await supabase.from('reminders').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', id);
      toast({ title: "Reminder completed" });
      fetchDashboardData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleMarkNotifRead = async (id: string) => {
    try {
      await supabase.rpc('mark_notification_read', { p_notification_id: id });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {}
  };

  const handleReviewLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingLeave || !reviewForm.reason.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('review_leave_request', { p_leave_request_id: reviewingLeave.id, p_status: reviewForm.status, p_manager_reason: reviewForm.reason });
      if (error) throw error;
      toast({ title: `Leave request ${reviewForm.status}` });
      setIsReviewModalOpen(false);
      setReviewingLeave(null);
      fetchDashboardData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
      forceUnlockUI();
    }
  };

  const handleCancelLeave = async (id: string) => {
    try {
      const { error } = await supabase.rpc('cancel_leave_request', { p_leave_request_id: id });
      if (error) throw error;
      toast({ title: "Leave request cancelled" });
      fetchDashboardData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const todaysTasks = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return tasks.filter(t => {
      if (!t.due_date || t.status === 'completed') return false;
      const due = new Date(t.due_date); due.setHours(0, 0, 0, 0);
      return due.getTime() === today.getTime();
    });
  }, [tasks]);

  if (loading && stats.length === 0) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  const isAdmin = userRole === 'superadmin' || userRole === 'admin';
  const isManager = isAdmin || userRole === 'manager' || hasPermission('approve_leave_requests');

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Welcome, {userProfile?.full_name?.split(' ')[0] || 'User'}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={handleRunNotificationChecks} disabled={isRunningChecks} className="h-10 gap-2 dark:border-slate-800 bg-white dark:bg-slate-900">
              {isRunningChecks ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="hidden sm:inline">Check Automations</span>
            </Button>
          )}
          <Button onClick={() => setIsReminderModalOpen(true)} className="h-10 gap-2 shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95">
            <Plus className="w-4 h-4" /> Quick Reminder
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm dark:bg-slate-900/50 bg-white/50 backdrop-blur-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-3xl font-extrabold mt-1 text-slate-900 dark:text-white">{stat.count}</p>
              </div>
              <div className={cn("p-4 rounded-2xl", stat.bg)}>
                <stat.icon className={cn("w-6 h-6 md:w-7 md:h-7", stat.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-10">
          <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600 px-1">Quick Workspace Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[ 
                { label: "New Task", icon: CheckSquare, href: "/tasks", color: "from-blue-500 to-blue-600", shadow: "shadow-blue-500/20" }, 
                { label: "Shared Note", icon: StickyNote, href: "/notes", color: "from-amber-500 to-amber-600", shadow: "shadow-amber-500/20" }, 
                { label: "Workspace Chat", icon: MessageSquare, href: "/chat", color: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-500/20" }, 
                { label: "Plan Leave", icon: PlaneTakeoff, href: "/leave", color: "from-violet-500 to-violet-600", shadow: "shadow-violet-500/20" }, 
              ].map((action) => { 
                const content = (
                  <div className={cn("flex flex-col items-center justify-center p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-primary/50 transition-all group cursor-pointer shadow-sm active:scale-95", action.shadow)}>
                    <div className={cn("p-4 rounded-2xl text-white bg-gradient-to-br shadow-lg mb-3 transform group-hover:scale-110 group-hover:-rotate-3 transition-transform", action.color)}>
                      <action.icon className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold dark:text-slate-200">{action.label}</span>
                  </div>
                ); 
                return action.href ? (<Link key={action.label} href={action.href}>{content}</Link>) : (<div key={action.label} onClick={action.onClick}>{content}</div>); 
              })}
            </div>
          </section>

          {isManager && leaveApprovals.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold flex items-center gap-3 text-slate-900 dark:text-white">
                  <div className="p-2 bg-rose-50 dark:bg-rose-500/10 rounded-lg"><Shield className="w-5 h-5 text-rose-500" /></div>
                  Pending Approvals
                </h2>
                <Link href="/leave"><Badge className="bg-rose-500 text-white rounded-full px-3 cursor-pointer">{leaveApprovals.length}</Badge></Link>
              </div>
              <div className="space-y-3">
                {leaveApprovals.map(leave => (
                  <Card key={leave.id} className="border-none shadow-md dark:bg-slate-900 group hover:shadow-lg transition-all">
                    <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-5">
                      <Avatar className="w-12 h-12 border-2 border-white dark:border-slate-800 shadow-sm">
                        <AvatarImage src={leave.avatar_preset ? `/avatars/${leave.avatar_preset}.png` : leave.avatar_url} />
                        <AvatarFallback className="font-bold bg-primary/10 text-primary uppercase text-lg">{leave.full_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-base dark:text-white">{leave.full_name}</span>
                          <Badge variant="secondary" className="text-[10px] uppercase font-bold py-0.5 tracking-wider dark:bg-slate-800">{leave.leave_type.replace('_', ' ')}</Badge>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center flex-wrap gap-x-4 gap-y-1">
                          <span className="flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5" /> {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}</span>
                          <span className="font-bold text-primary">Return: {new Date(leave.return_date).toLocaleDateString()}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{leave.number_of_days} Business Days</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="ghost" className="text-slate-500 hover:text-rose-500 h-9" onClick={() => { setReviewingLeave(leave); setReviewForm({ status: 'rejected', reason: "" }); setIsReviewModalOpen(true); }}>Reject</Button>
                        <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white h-9 shadow-lg shadow-emerald-500/20" onClick={() => { setReviewingLeave(leave); setReviewForm({ status: 'approved', reason: "" }); setIsReviewModalOpen(true); }}>Approve</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold flex items-center gap-3 text-slate-900 dark:text-white">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg"><Palmtree className="w-5 h-5 text-emerald-500" /></div>
                Team Presence
              </h2>
              <Link href="/leave"><Button variant="ghost" size="sm" className="text-primary font-bold">Full Schedule</Button></Link>
            </div>
            <Card className="border-none shadow-md bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden">
              <CardContent className="p-6">
                {teamPresence.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center py-4">Everyone is currently in the office.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {teamPresence.map(leave => (
                      <div key={leave.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border dark:border-slate-800">
                        <Avatar className="h-10 w-10 border dark:border-slate-700">
                          <AvatarImage src={leave.avatar_preset ? `/avatars/${leave.avatar_preset}.png` : leave.avatar_url} />
                          <AvatarFallback>{leave.full_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate dark:text-slate-100">{leave.full_name}</p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                            Away until {new Date(leave.return_date).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="secondary" className="bg-white dark:bg-slate-900 text-[9px] uppercase font-bold px-1.5 h-4">{leave.leave_type.split('_')[0]}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold flex items-center gap-3 text-slate-900 dark:text-white">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg"><CheckCircle className="w-5 h-5 text-emerald-500" /></div>
                Assigned to Me: Today
              </h2>
              <Link href="/tasks"><Button variant="ghost" size="sm" className="text-primary font-bold gap-1 group">View Board <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" /></Button></Link>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {todaysTasks.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 dark:bg-slate-900/40 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4 opacity-70">
                  <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm"><CheckCircle2 className="w-8 h-8 text-emerald-400" /></div>
                  <div><p className="text-lg font-bold text-slate-600 dark:text-slate-300">Workspace is all clear!</p><p className="text-sm text-slate-400 mt-1">You have no tasks due today.</p></div>
                </div>
              ) : (todaysTasks.map(task => (<TaskDashboardCard key={task.id} task={task} />)))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold flex items-center gap-3 text-slate-900 dark:text-white">
                <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg"><History className="w-5 h-5 text-blue-500" /></div>
                Recent Activity
              </h2>
            </div>
            <Card className="border-none shadow-md bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden">
              <CardContent className="p-0">
                {activity.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center py-12">No recent activity yet.</p>
                ) : (
                  <div className="divide-y dark:divide-slate-800">
                    {activity.map((item) => {
                      const config = activityConfig[item.action] || { label: item.action, icon: Zap, color: "text-slate-400", bg: "bg-slate-400" };
                      return (
                        <div key={item.id} className="p-5 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <div className="relative shrink-0">
                            <Avatar className="h-10 w-10 border dark:border-slate-800 shadow-sm">
                              <AvatarImage src={item.actor_avatar_preset ? `/avatars/${item.actor_avatar_preset}.png` : item.actor_avatar_url} />
                              <AvatarFallback className="text-[10px]">{item.actor_full_name?.[0]}</AvatarFallback>
                            </Avatar>
                            {item.actor_is_verified && (
                              <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-950 rounded-full p-0.5 shadow-sm border dark:border-slate-800">
                                <BadgeCheck className="w-3.5 h-3.5 text-primary fill-primary/10" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm dark:text-slate-200">
                              <span className="font-bold text-slate-900 dark:text-white mr-1 flex items-center gap-1">
                                {item.actor_full_name}
                              </span>
                              <span className="text-muted-foreground">{config.label}</span>
                              <span className="font-bold ml-1 text-primary">{item.task_title}</span>
                            </p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {item.sub_workspace_name && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 h-4 border-none bg-blue-50 dark:bg-blue-500/10 text-blue-600">
                                  {item.sub_workspace_name}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className={cn("p-2 rounded-lg shrink-0 opacity-40", config.color)}>
                            <config.icon className="w-4 h-4" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        <div className="lg:col-span-4 space-y-10">
          <Card className="border-none shadow-lg bg-violet-600 dark:bg-violet-700 text-white rounded-[2rem] overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <CardHeader className="p-6 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md"><Clock className="w-5 h-5 text-white" /></div>
                  <CardTitle className="text-lg">My Reminders</CardTitle>
                </div>
                <Badge className="bg-white/20 text-white border-none">{reminders.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-3">
              {reminders.length === 0 ? (
                <div className="py-4 text-center"><p className="text-sm opacity-60 italic">No scheduled reminders.</p></div>
              ) : (reminders.map((r) => (
                <div key={r.id} className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex items-center justify-between group/item transition-colors">
                  <div className="min-w-0 mr-3"><p className="text-sm font-bold truncate leading-tight">{r.title}</p><p className="text-[10px] opacity-70 mt-1 uppercase font-bold tracking-widest">{new Date(r.remind_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(r.remind_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p></div>
                  <button onClick={() => handleCompleteReminder(r.id)} className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg transform scale-0 group-hover/item:scale-100 transition-transform hover:scale-110 active:scale-95"><CheckSquare className="w-4 h-4 text-white" /></button>
                </div>
              )))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md dark:bg-slate-900 rounded-[2rem] overflow-hidden">
            <CardHeader className="p-6 pb-2 border-b dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Latest Alerts</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y dark:divide-slate-800">
                {notifications.length === 0 ? (
                  <p className="text-sm text-slate-400 italic py-10 text-center">Your inbox is clear.</p>
                ) : (notifications.map((n) => (
                  <div key={n.id} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group relative">
                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate pr-6">{n.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">{n.message}</p>
                    <div className="mt-2 flex items-center justify-between"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{new Date(n.created_at).toLocaleDateString()}</span><button onClick={() => handleMarkNotifRead(n.id)} className="text-primary hover:text-primary/70 transition-colors"><CheckCircle2 className="w-4 h-4" /></button></div>
                  </div>
                )))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md dark:bg-slate-900 rounded-[2rem] overflow-hidden">
            <CardHeader className="p-6 pb-2">
              <div className="flex items-center gap-3">
                <PlaneTakeoff className="w-5 h-5 text-violet-500" />
                <CardTitle className="text-lg">My Absence</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-4">
              {leaveRequests.length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center py-4">No absences planned.</p>
              ) : (
                <div className="space-y-3">
                  {leaveRequests.slice(0, 3).map(leave => (
                    <div key={leave.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border dark:border-slate-800 flex items-center justify-between group">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold dark:text-slate-200">{new Date(leave.start_date).toLocaleDateString()}</p>
                          <Badge variant="outline" className={cn("text-[8px] uppercase font-bold py-0 h-4 px-1.5", 
                            leave.status === 'pending' ? "border-amber-500 text-amber-500" :
                            leave.status === 'approved' ? "border-emerald-500 text-emerald-500" :
                            "border-rose-500 text-rose-500"
                          )}>{leave.status}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{leave.number_of_days} days • {leave.leave_type.split('_')[0]}</p>
                      </div>
                      {leave.status === 'pending' && (
                        <button onClick={() => handleCancelLeave(leave.id)} className="text-rose-500 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Link href="/leave" className="block w-full">
                <Button variant="outline" className="w-full rounded-xl text-xs h-9 border-slate-200 dark:border-slate-800">
                  Manage Leave
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md dark:bg-slate-900 rounded-[2rem] overflow-hidden">
            <CardHeader className="p-6 pb-2">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Workspace Team</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <div className="grid grid-cols-4 gap-4">
                {members.map((member) => (
                  <div key={member.user_id} className="flex flex-col items-center gap-2 group/member">
                    <div className="relative">
                      <Avatar className="h-12 w-12 border-2 border-white dark:border-slate-800 shadow-sm transition-transform group-hover/member:scale-110">
                        <AvatarImage src={member.profiles?.avatar_preset ? `/avatars/${member.profiles.avatar_preset}.png` : member.profiles?.avatar_url} />
                        <AvatarFallback className="text-[10px] bg-primary/5 text-primary font-bold">{member.profiles?.full_name?.[0]}</AvatarFallback>
                      </Avatar>
                      {member.is_verified && (
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-950 rounded-full p-0.5 shadow-sm">
                          <BadgeCheck className="w-3.5 h-3.5 text-primary fill-primary/10" />
                        </div>
                      )}
                    </div>
                    <div className="text-center min-w-0 w-full">
                      <p className="text-[9px] font-bold truncate dark:text-slate-300 leading-tight">
                        {member.profiles?.full_name?.split(' ')[0]}
                      </p>
                      <p className="text-[8px] text-muted-foreground uppercase tracking-tighter opacity-60">
                        {member.role}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/workspace" className="block w-full mt-6">
                <Button variant="ghost" className="w-full rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-primary">
                  View All Members
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isReminderModalOpen} onOpenChange={(open) => { if (!saving) { setIsReminderModalOpen(open); if (!open) forceUnlockUI(); } }}>
        <DialogContent className="sm:max-w-md p-8 rounded-[2rem] dark:bg-slate-950 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">Create Quick Reminder</DialogTitle>
            <DialogDescription>Set a ping for yourself or your team members later.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateReminder} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Reminder Title</Label>
              <Input value={newReminder.title} onChange={e => setNewReminder({...newReminder, title: e.target.value})} placeholder="e.g. Call client back about project" required disabled={saving} className="h-12 rounded-xl dark:bg-slate-900 dark:border-slate-800 px-4" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Due Date & Time</Label>
              <Input type="datetime-local" value={newReminder.remindAt} onChange={e => setNewReminder({...newReminder, remindAt: e.target.value})} required disabled={saving} className="h-12 rounded-xl dark:bg-slate-900 dark:border-slate-800 px-4" />
            </div>
            <DialogFooter className="flex-row gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsReminderModalOpen(false)} className="flex-1 rounded-xl h-12" disabled={saving}>Cancel</Button>
              <Button type="submit" className="flex-1 rounded-xl h-12 shadow-lg shadow-primary/20" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Schedule"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isReviewModalOpen} onOpenChange={(open) => { if (!saving) { setIsReviewModalOpen(open); if (!open) { setReviewingLeave(null); forceUnlockUI(); } } }}>
        <DialogContent className="sm:max-w-md p-8 rounded-[2rem] dark:bg-slate-950 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">Review Leave Request</DialogTitle>
            <DialogDescription>Decision for {reviewingLeave?.full_name}'s {reviewingLeave?.leave_type?.replace('_', ' ')}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReviewLeave} className="space-y-5 pt-4">
            <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-800 text-sm space-y-2">
              <div className="flex justify-between font-medium"><span>Duration:</span> <span className="font-bold text-primary">{reviewingLeave?.number_of_days} Days</span></div>
              <div className="flex justify-between font-medium"><span>Dates:</span> <span className="font-bold">{new Date(reviewingLeave?.start_date || new Date()).toLocaleDateString()} - {new Date(reviewingLeave?.end_date || new Date()).toLocaleDateString()}</span></div>
              {reviewingLeave?.reason && <div className="mt-3 text-xs italic text-slate-500 border-t pt-2 opacity-80">"{reviewingLeave.reason}"</div>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Manager Reason / Feedback</Label>
              <Textarea value={reviewForm.reason} onChange={e => setReviewForm({...reviewForm, reason: e.target.value})} placeholder="Why is this being approved/rejected?" rows={4} required className="rounded-xl dark:bg-slate-900 dark:border-slate-800" />
            </div>
            <DialogFooter className="pt-2 gap-3 flex-row">
              <Button type="button" variant="ghost" onClick={() => setIsReviewModalOpen(false)} className="flex-1 h-12 rounded-xl">Cancel</Button>
              <Button type="submit" className={cn("flex-1 h-12 rounded-xl shadow-lg text-white", reviewForm.status === 'approved' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600')} disabled={saving || !reviewForm.reason.trim()}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : reviewForm.status === 'approved' ? 'Confirm Approval' : 'Submit Rejection'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskDashboardCard({ task }: { task: any }) {
  const taskProgress = task.progress_mode === 'manual' ? (task.manual_progress || 0) : (task.calculated_progress || 0);
  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden bg-white dark:bg-slate-900 rounded-2xl">
      <CardContent className="p-5 flex items-center gap-5">
        <div className={cn("w-1.5 h-12 rounded-full shrink-0", task.priority === 'urgent' ? 'bg-rose-500' : task.priority === 'high' ? 'bg-amber-500' : 'bg-primary')} />
        <div className="flex-1 min-w-0">
          <Link href={`/tasks?taskId=${task.id}`} className="hover:text-primary transition-colors flex items-center gap-2 group/title">
            <h3 className="font-extrabold truncate text-slate-800 dark:text-white group-hover/title:translate-x-1 transition-transform">{task.title}</h3>
            {task.is_overdue && <Badge variant="destructive" className="h-4 text-[8px] uppercase px-1.5">Late</Badge>}
          </Link>
          <div className="flex items-center gap-3 mt-1 text-[11px] font-bold text-slate-400">
            <span className="flex items-center gap-1.5 capitalize"><Clock className="w-3.5 h-3.5" /> {task.status.replace('_', ' ')}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5" /> {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}</span>
          </div>
        </div>
        <div className="text-right shrink-0 hidden sm:block">
          <div className="flex items-center justify-end gap-2 mb-1.5">
            <span className="text-[10px] font-extrabold text-primary">{Math.round(taskProgress)}%</span>
            <Progress value={taskProgress} className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-slate-300 group-hover:text-primary transition-colors"><MoreHorizontal className="w-5 h-5" /></Button>
      </CardContent>
    </Card>
  );
}
