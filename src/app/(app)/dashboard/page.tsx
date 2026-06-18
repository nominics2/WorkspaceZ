
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  LayoutDashboard, 
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
  FileText,
  Shield,
  ArrowRightCircle
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const activityConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  task_created: { label: "created task", icon: CheckSquare, color: "text-blue-500", bg: "bg-blue-500" },
  task_updated: { label: "updated task", icon: RefreshCw, color: "text-slate-500", bg: "bg-slate-500" },
  task_completed: { label: "completed task", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500" },
  subtask_created: { label: "added subtask to", icon: CheckSquare, color: "text-blue-400", bg: "bg-blue-400" },
  subtask_completed: { label: "completed subtask in", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400" },
  comment_added: { label: "commented on", icon: MessageSquare, color: "text-indigo-500", bg: "bg-indigo-500" },
  attachment_uploaded: { label: "attached file to", icon: Paperclip, color: "text-slate-500", bg: "bg-slate-500" },
  note_created: { label: "created note", icon: StickyNote, color: "text-amber-500", bg: "bg-amber-500" },
  note_updated: { label: "updated note", icon: StickyNote, color: "text-amber-600", bg: "bg-amber-600" },
  task_moved_to_trash: { label: "deleted task", icon: Trash2, color: "text-rose-500", bg: "bg-rose-500" },
  task_restored_from_trash: { label: "restored task", icon: RefreshCw, color: "text-emerald-500", bg: "bg-emerald-500" },
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
  const [leaveApprovals, setLeaveApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  
  // Reminders Modal
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [newReminder, setNewReminder] = useState({ title: "", remindAt: "" });

  // Leave Planner Modals
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<any>(null);
  const [leaveForm, setLeaveForm] = useState({
    startDate: "",
    days: "1",
    type: "annual_leave",
    reason: ""
  });

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingLeave, setReviewingLeave] = useState<any>(null);
  const [reviewForm, setReviewForm] = useState({
    status: "" as "approved" | "rejected",
    reason: ""
  });
  
  const supabase = createClient();
  const { toast } = useToast();

  const forceUnlockUI = () => {
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = "";
    }
  };

  useEffect(() => {
    return () => forceUnlockUI();
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!activeWorkspace || !userProfile) return;
    setLoading(true);
    try {
      // 1. Fetch My Tasks
      const { data: myTasks } = await supabase
        .from('my_tasks_view')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('due_date', { ascending: true });
      
      const activeTasks = myTasks?.filter(t => t.status !== 'completed') || [];
      const completedTasks = myTasks?.filter(t => t.status === 'completed') || [];
      const overdueTasks = myTasks?.filter(t => t.is_overdue && t.status !== 'completed') || [];
      const dueSoonTasks = myTasks?.filter(t => {
        if (!t.due_date || t.status === 'completed') return false;
        const due = new Date(t.due_date);
        const soon = new Date();
        soon.setDate(soon.getDate() + 3);
        return due <= soon && due >= new Date();
      }) || [];

      setStats([
        { label: "Active", count: activeTasks.length, icon: Clock, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
        { label: "Due Soon", count: dueSoonTasks.length, icon: CalendarDays, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
        { label: "Overdue", count: overdueTasks.length, icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-500/10" },
        { label: "Completed", count: completedTasks.length, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
      ]);

      setTasks(myTasks || []);

      // 2. Activity Feed
      const { data: recentLogs } = await supabase
        .from('recent_activity_view')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const actorIds = [...new Set((recentLogs || []).map(log => log.actor_id))];
      const { data: memberData } = await supabase
        .from('workspace_members')
        .select('user_id, is_verified')
        .eq('workspace_id', activeWorkspace.id)
        .in('user_id', actorIds);

      const enrichedLogs = (recentLogs || []).map(log => ({
        ...log,
        actor_is_verified: !!memberData?.find(m => m.user_id === log.actor_id)?.is_verified
      }));

      setActivity(enrichedLogs);

      // 3. Notifications
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userProfile.id)
        .eq('is_read', false)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(5);
      setNotifications(notifs || []);

      // 4. Reminders
      const { data: rems } = await supabase
        .from('reminders')
        .select('*')
        .eq('remind_to', userProfile.id)
        .eq('is_completed', false)
        .order('remind_at', { ascending: true })
        .limit(5);
      setReminders(rems || []);

      // 5. Workload
      if (userRole === 'superadmin' || hasPermission('view_admin_panel') || hasPermission('view_all_tasks')) {
        const { data: work } = await supabase
          .from('member_workload_view')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .order('active_tasks', { ascending: false });
        setWorkload(work || []);
      }

      // 6. Leave Requests
      const { data: leaves } = await supabase
        .from('leave_requests_view')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .eq('user_id', userProfile.id)
        .order('start_date', { ascending: false });
      setLeaveRequests(leaves || []);

      // 7. Pending Approvals
      if (userRole === 'superadmin' || userRole === 'admin' || userRole === 'manager' || hasPermission('approve_leave_requests')) {
        const { data: approvals } = await supabase
          .from('leave_requests_view')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .eq('status', 'pending')
          .neq('user_id', userProfile.id)
          .order('created_at', { ascending: true });
        setLeaveApprovals(approvals || []);
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, userProfile, userRole, hasPermission, supabase]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRunNotificationChecks = async () => {
    if (!activeWorkspace) return;
    setIsRunningChecks(true);
    try {
      const response = await fetch("/api/admin/run-notification-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: activeWorkspace.id }),
      });
      if (!response.ok) throw new Error("Check failed");
      toast({ title: "Checks completed" });
      fetchDashboardData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsRunningChecks(false);
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !userProfile) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('reminders').insert({
        workspace_id: activeWorkspace.id,
        created_by: userProfile.id,
        remind_to: userProfile.id,
        title: newReminder.title,
        remind_at: new Date(newReminder.remindAt).toISOString()
      });
      if (error) throw error;
      toast({ title: "Reminder set!" });
      setIsReminderModalOpen(false);
      setNewReminder({ title: "", remindAt: "" });
      forceUnlockUI();
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
    } catch (err) {
      console.error(err);
    }
  };

  // Leave Requests Handlers
  const openLeaveModal = (leave: any = null) => {
    if (leave) {
      setEditingLeave(leave);
      setLeaveForm({
        startDate: leave.start_date.split('T')[0],
        days: leave.number_of_days.toString(),
        type: leave.leave_type,
        reason: leave.reason || ""
      });
    } else {
      setEditingLeave(null);
      setLeaveForm({
        startDate: new Date().toISOString().split('T')[0],
        days: "1",
        type: "annual_leave",
        reason: ""
      });
    }
    setIsLeaveModalOpen(true);
  };

  const handleSaveLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !userProfile) return;
    setSaving(true);
    try {
      if (editingLeave) {
        const { error } = await supabase.rpc('update_leave_request', {
          p_leave_request_id: editingLeave.id,
          p_start_date: leaveForm.startDate,
          p_number_of_days: parseInt(leaveForm.days),
          p_leave_type: leaveForm.type,
          p_reason: leaveForm.reason
        });
        if (error) throw error;
        toast({ title: "Leave request updated" });
      } else {
        const { error } = await supabase.rpc('create_leave_request', {
          p_workspace_id: activeWorkspace.id,
          p_start_date: leaveForm.startDate,
          p_number_of_days: parseInt(leaveForm.days),
          p_leave_type: leaveForm.type,
          p_reason: leaveForm.reason
        });
        if (error) throw error;
        toast({ title: "Leave request submitted", description: "Your manager will review it shortly." });
      }
      setIsLeaveModalOpen(false);
      forceUnlockUI();
      fetchDashboardData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
      forceUnlockUI();
    }
  };

  const handleCancelLeave = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;
    try {
      const { error } = await supabase.rpc('cancel_leave_request', { p_leave_request_id: id });
      if (error) throw error;
      toast({ title: "Leave request cancelled" });
      fetchDashboardData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleReviewLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingLeave) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('review_leave_request', {
        p_leave_request_id: reviewingLeave.id,
        p_status: reviewForm.status,
        p_manager_reason: reviewForm.reason
      });
      if (error) throw error;
      toast({ title: `Leave request ${reviewForm.status}` });
      setIsReviewModalOpen(false);
      setReviewingLeave(null);
      forceUnlockUI();
      fetchDashboardData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
      forceUnlockUI();
    }
  };

  const todaysTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.filter(t => {
      if (!t.due_date || t.status === 'completed') return false;
      const due = new Date(t.due_date);
      due.setHours(0, 0, 0, 0);
      return due.getTime() === today.getTime();
    });
  }, [tasks]);

  // Frontend calculation for live preview (skipping Fridays)
  const previewDates = useMemo(() => {
    if (!leaveForm.startDate || !leaveForm.days) return null;
    const numDays = parseInt(leaveForm.days);
    if (isNaN(numDays) || numDays <= 0) return null;

    let current = new Date(leaveForm.startDate);
    let daysToTake = numDays;
    let lastLeaveDay = new Date(current);

    // If start date is a Friday, move to Saturday as the first possible leave day
    // though the request officially starts on the Friday.
    // The requirement says: "If the selected start date is Friday, do not block it, 
    // but the first counted leave day should be the next non-Friday date."

    let counter = 0;
    let checkDate = new Date(current);

    while (daysToTake > 0) {
      if (checkDate.getDay() !== 5) { // Not Friday
        daysToTake--;
        lastLeaveDay = new Date(checkDate);
      }
      if (daysToTake > 0) {
        checkDate.setDate(checkDate.getDate() + 1);
      }
      counter++;
      if (counter > 100) break; // Safety
    }

    const endDate = lastLeaveDay;
    const returnDate = new Date(endDate);
    returnDate.setDate(returnDate.getDate() + 1);
    
    // If return date is Friday, skip to Saturday
    if (returnDate.getDay() === 5) {
      returnDate.setDate(returnDate.getDate() + 1);
    }

    return {
      endDate: endDate.toLocaleDateString(),
      returnDate: returnDate.toLocaleDateString()
    };
  }, [leaveForm.startDate, leaveForm.days]);

  if (loading && stats.length === 0) {
    return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const isAdmin = userRole === 'superadmin' || userRole === 'admin';
  const isManager = isAdmin || userRole === 'manager' || hasPermission('approve_leave_requests');

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-950 dark:text-slate-100">Hello, {userProfile?.full_name?.split(' ')[0] || 'User'}</h1>
          <p className="text-sm text-muted-foreground">Here's what's happening in {activeWorkspace?.name} today.</p>
        </div>
        <div className="flex items-center gap-2">
           {isAdmin && (
             <Button variant="outline" size="sm" onClick={handleRunNotificationChecks} disabled={isRunningChecks} className="h-9 gap-2 dark:border-slate-800">
               {isRunningChecks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
               <span className="hidden sm:inline">Run Checks</span>
             </Button>
           )}
           <Button onClick={() => setIsReminderModalOpen(true)} size="sm" className="h-9 gap-2 shadow-lg shadow-primary/20">
             <Clock className="w-4 h-4" /> Quick Reminder
           </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm dark:bg-slate-900">
            <CardContent className="p-4 md:p-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl md:text-2xl font-bold mt-1 text-slate-950 dark:text-slate-100">{stat.count}</p>
              </div>
              <div className={cn("p-2 md:p-3 rounded-xl", stat.bg)}>
                <stat.icon className={cn("w-5 h-5 md:w-6 md:h-6", stat.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        {/* Left Column - Tasks & Activity */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Leave Approvals (Manager only) */}
          {isManager && leaveApprovals.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                 <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                   <Shield className="w-5 h-5 text-primary" />
                   Pending Leave Approvals
                 </h2>
                 <Badge variant="default" className="bg-primary">{leaveApprovals.length}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-3">
                 {leaveApprovals.map(leave => (
                   <Card key={leave.id} className="border-none shadow-sm dark:bg-slate-900 group">
                     <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                       <Avatar className="w-10 h-10 border dark:border-slate-800">
                         <AvatarImage src={leave.avatar_preset ? `/avatars/${leave.avatar_preset}.png` : leave.avatar_url} />
                         <AvatarFallback className="text-[10px] font-bold bg-primary/5 text-primary">
                           {leave.full_name?.[0]}
                         </AvatarFallback>
                       </Avatar>
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2 mb-0.5">
                           <span className="font-bold text-sm dark:text-slate-100">{leave.full_name}</span>
                           <Badge variant="outline" className="text-[9px] uppercase dark:border-slate-800">{leave.leave_type.replace('_', ' ')}</Badge>
                         </div>
                         <div className="text-[10px] text-muted-foreground flex items-center flex-wrap gap-x-3 gap-y-1">
                           <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}</span>
                           <span className="flex items-center gap-1 font-bold text-primary">Return: {new Date(leave.return_date).toLocaleDateString()}</span>
                           <span className="font-bold text-slate-900 dark:text-slate-100">{leave.number_of_days} days</span>
                         </div>
                         {leave.reason && <p className="text-[10px] italic mt-1 line-clamp-1">"{leave.reason}"</p>}
                       </div>
                       <div className="flex items-center gap-2">
                         <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          onClick={() => {
                            setReviewingLeave(leave);
                            setReviewForm({ status: 'rejected', reason: "" });
                            setIsReviewModalOpen(true);
                          }}
                         >
                           Reject
                         </Button>
                         <Button 
                          size="sm" 
                          className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white"
                          onClick={() => {
                            setReviewingLeave(leave);
                            setReviewForm({ status: 'approved', reason: "" });
                            setIsReviewModalOpen(true);
                          }}
                         >
                           Approve
                         </Button>
                       </div>
                     </CardContent>
                   </Card>
                 ))}
              </div>
            </section>
          )}

          {/* Quick Actions */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Task", icon: CheckSquare, href: "/tasks", color: "bg-blue-500" },
                { label: "Note", icon: StickyNote, href: "/notes", color: "bg-amber-500" },
                { label: "Chat", icon: MessageSquare, href: "/chat", color: "bg-emerald-500" },
                { label: "Plan Leave", icon: PlaneTakeoff, onClick: () => openLeaveModal(), color: "bg-violet-500" },
              ].map((action) => {
                const Content = (
                  <Card className="border-none shadow-sm hover:translate-y-[-2px] transition-all cursor-pointer group dark:bg-slate-900">
                    <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
                      <div className={cn("p-3 rounded-xl text-white shadow-lg shadow-black/10", action.color)}>
                        <action.icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold dark:text-slate-100">{action.label}</span>
                    </CardContent>
                  </Card>
                );
                return action.href ? (
                  <Link key={action.label} href={action.href}>{Content}</Link>
                ) : (
                  <div key={action.label} onClick={action.onClick}>{Content}</div>
                );
              })}
            </div>
          </section>

          {/* Today's Tasks */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                Assigned to Me: Today
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {todaysTasks.length === 0 ? (
                <div className="p-10 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center gap-2">
                  <p className="text-sm font-bold text-slate-400">All clear for today!</p>
                  <p className="text-xs text-muted-foreground">No tasks due today.</p>
                </div>
              ) : (
                todaysTasks.map(task => (
                  <TaskDashboardCard key={task.id} task={task} />
                ))
              )}
            </div>
          </section>

          {/* Leave Planner List */}
          <section className="space-y-4">
             <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <PlaneTakeoff className="w-5 h-5 text-violet-500" />
                  My Leave Planner
                </h2>
                <Button variant="ghost" size="sm" onClick={() => openLeaveModal()} className="text-xs gap-1 text-primary">
                  <Plus className="w-3.5 h-3.5" /> Plan Leave
                </Button>
             </div>
             <Card className="border-none shadow-sm dark:bg-slate-900 overflow-hidden">
                <CardContent className="p-0">
                  {leaveRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic text-center py-10">No leave requests planned.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                       {leaveRequests.map(leave => (
                         <div key={leave.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                            <div className="flex items-start gap-4 flex-1">
                               <div className={cn(
                                 "p-2.5 rounded-xl shrink-0",
                                 leave.leave_type === 'sick_leave' ? "bg-rose-50 text-rose-500 dark:bg-rose-500/10" :
                                 leave.leave_type === 'annual_leave' ? "bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10" :
                                 "bg-blue-50 text-blue-500 dark:bg-blue-500/10"
                               )}>
                                 <PlaneTakeoff className="w-5 h-5" />
                               </div>
                               <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                     <span className="font-bold text-sm capitalize dark:text-slate-100">{leave.leave_type.replace('_', ' ')}</span>
                                     <Badge className={cn(
                                       "text-[9px] uppercase tracking-wider h-4 px-1.5",
                                       leave.status === 'pending' ? "bg-amber-500" :
                                       leave.status === 'approved' ? "bg-emerald-500" :
                                       leave.status === 'rejected' ? "bg-rose-500" :
                                       "bg-slate-400"
                                     )}>
                                       {leave.status}
                                     </Badge>
                                  </div>
                                  <div className="flex flex-col gap-0.5 mt-1">
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(leave.start_date).toLocaleDateString()} — {new Date(leave.end_date).toLocaleDateString()}
                                    </p>
                                    <div className="flex items-center gap-3 text-[10px] font-bold text-primary uppercase">
                                      <span className="flex items-center gap-1">
                                        <ArrowRightCircle className="w-3 h-3" />
                                        Return: {new Date(leave.return_date).toLocaleDateString()}
                                      </span>
                                      <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">
                                        {leave.number_of_days} Business Days
                                      </span>
                                    </div>
                                  </div>
                                  {leave.manager_reason && (
                                    <p className="text-[10px] text-muted-foreground mt-1 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border dark:border-slate-800">
                                      <span className="font-bold">Feedback:</span> {leave.manager_reason}
                                    </p>
                                  )}
                               </div>
                            </div>
                            <div className="flex items-center gap-2">
                               {leave.status === 'pending' && (
                                 <>
                                   <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => openLeaveModal(leave)}>
                                     <RefreshCw className="w-4 h-4" />
                                   </Button>
                                   <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500" onClick={() => handleCancelLeave(leave.id)}>
                                     <XCircle className="w-4 h-4" />
                                   </Button>
                                 </>
                               )}
                            </div>
                         </div>
                       ))}
                    </div>
                  )}
                </CardContent>
             </Card>
          </section>

          {/* Activity Feed */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Recent Activity</h2>
            <Card className="border-none shadow-sm dark:bg-slate-900">
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activity.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic text-center py-10">No recent activity yet.</p>
                  ) : (
                    activity.map((log) => {
                      const config = activityConfig[log.action] || { 
                        label: log.action_description || log.action?.replace(/_/g, ' ') || "performed an action", 
                        icon: TrendingUp, 
                        color: "text-slate-500", 
                        bg: "bg-slate-100 dark:bg-slate-800" 
                      };
                      const ActionIcon = config.icon;
                      
                      const actorName = log.actor_full_name || log.actor_username || log.actor_email || "Someone";
                      const avatarSrc = log.actor_avatar_preset ? `/avatars/${log.actor_avatar_preset}.png` : log.actor_avatar_url;
                      
                      const targetTitle = log.task_title || log.note_title || "";

                      return (
                        <div key={log.id} className="p-4 flex gap-4 group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="relative shrink-0">
                            <Avatar className="w-10 h-10 border dark:border-slate-800 shadow-sm">
                              <AvatarImage src={avatarSrc} />
                              <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                                {actorName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className={cn(
                              "absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm",
                              config.bg
                            )}>
                              <ActionIcon className="w-2.5 h-2.5 text-white" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs md:text-sm text-foreground leading-relaxed dark:text-slate-300">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-bold text-slate-950 dark:text-slate-100">{actorName}</span>
                                {log.actor_is_verified && <BadgeCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                                <span className="ml-1">{config.label}</span>
                                {targetTitle && <span className="font-bold text-primary">"{targetTitle}"</span>}
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(log.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Right Column - Reminders, Notifs, Workload */}
        <div className="lg:col-span-4 space-y-8">
          {/* Reminders */}
          <Card className="border-none shadow-sm bg-violet-50/50 dark:bg-violet-950/10 border-violet-100/50 dark:border-violet-900/20">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  <CardTitle className="text-sm dark:text-slate-100">My Reminders</CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] h-4 bg-white dark:bg-slate-900 border-violet-200 dark:border-violet-800">{reminders.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              {reminders.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">No active reminders.</p>
              ) : (
                reminders.map((r) => (
                  <div key={r.id} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between group animate-in slide-in-from-right-2">
                    <div className="space-y-0.5 overflow-hidden">
                      <p className="text-xs font-bold truncate dark:text-slate-100">{r.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.remind_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" onClick={() => handleCompleteReminder(r.id)}>
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-none shadow-sm dark:bg-slate-900">
            <CardHeader className="p-4 pb-2 border-b dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm dark:text-slate-100">Latest Alerts</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic p-4 text-center">All caught up!</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-4 text-xs group relative hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <p className="font-bold truncate pr-6 dark:text-slate-200">{n.title}</p>
                      <p className="text-muted-foreground leading-relaxed line-clamp-2 mt-0.5">{n.message}</p>
                      <button 
                        onClick={() => handleMarkNotifRead(n.id)}
                        className="absolute right-4 top-4 text-primary p-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        title="Mark as read"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Team Workload */}
          {workload.length > 0 && (
            <Card className="border-none shadow-sm dark:bg-slate-900">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm dark:text-slate-100">Team Workload</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-4">
                {workload.map((w, index) => (
                  <div key={w.user_id || `${w.email}-${index}`} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold truncate max-w-[120px] dark:text-slate-300">{w.full_name || w.email || "Unknown Member"}</span>
                      <div className="flex items-center gap-2">
                        {w.overdue_tasks > 0 && <Badge variant="destructive" className="h-4 text-[8px]">{w.overdue_tasks} overdue</Badge>}
                        <span className="text-muted-foreground">{w.active_tasks} active</span>
                      </div>
                    </div>
                    <Progress value={(w.completed_tasks / (w.active_tasks + w.completed_tasks || 1)) * 100} className="h-1" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Reminder Modal */}
      <Dialog open={isReminderModalOpen} onOpenChange={(open) => { 
        if (!saving) {
          setIsReminderModalOpen(open);
          if (!open) forceUnlockUI();
        }
      }}>
        <DialogContent className="w-[95vw] max-w-md p-6 rounded-2xl dark:bg-slate-950 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100">Quick Reminder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateReminder} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold dark:text-slate-300">What should we remind you about?</Label>
              <Input 
                value={newReminder.title} 
                onChange={e => setNewReminder({...newReminder, title: e.target.value})} 
                placeholder="e.g. Follow up on proposal"
                required
                disabled={saving}
                className="h-11 dark:bg-slate-900 dark:border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold dark:text-slate-300">When?</Label>
              <Input 
                type="datetime-local"
                value={newReminder.remindAt} 
                onChange={e => setNewReminder({...newReminder, remindAt: e.target.value})} 
                required
                disabled={saving}
                className="h-11 dark:bg-slate-900 dark:border-slate-800"
              />
            </div>
            <DialogFooter className="flex flex-row gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsReminderModalOpen(false)} className="flex-1 dark:hover:bg-slate-800" disabled={saving}>Cancel</Button>
              <Button type="submit" className="flex-1 shadow-lg shadow-primary/20" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set Reminder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Leave Request Modal */}
      <Dialog open={isLeaveModalOpen} onOpenChange={(open) => { 
        if (!saving) {
          setIsLeaveModalOpen(open);
          if (!open) forceUnlockUI();
        }
      }}>
        <DialogContent className="w-[95vw] max-w-md p-6 rounded-2xl dark:bg-slate-950 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100">{editingLeave ? 'Edit Leave Request' : 'Plan Leave'}</DialogTitle>
            <DialogDescription>Submit your absence for manager approval. <span className="text-primary font-bold">Fridays are excluded.</span></DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveLeave} className="space-y-4 pt-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <Label className="text-xs font-bold dark:text-slate-300">Start Date</Label>
                   <Input 
                    type="date" 
                    value={leaveForm.startDate} 
                    onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})}
                    required
                    disabled={saving}
                    className="dark:bg-slate-900 dark:border-slate-800"
                   />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-bold dark:text-slate-300">Duration (Days)</Label>
                   <Input 
                    type="number" 
                    min="1" 
                    max="30"
                    value={leaveForm.days} 
                    onChange={e => setLeaveForm({...leaveForm, days: e.target.value})}
                    required
                    disabled={saving}
                    className="dark:bg-slate-900 dark:border-slate-800"
                   />
                </div>
             </div>

             {/* Live Preview */}
             {previewDates && (
               <div className="p-3 bg-violet-50 dark:bg-violet-500/10 rounded-lg border border-violet-100 dark:border-violet-900/30 text-[10px] space-y-1">
                 <div className="flex justify-between items-center">
                    <span className="text-muted-foreground uppercase font-bold tracking-widest">End Date:</span>
                    <span className="font-bold text-violet-700 dark:text-violet-300">{previewDates.endDate}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-muted-foreground uppercase font-bold tracking-widest">Return Date:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{previewDates.returnDate}</span>
                 </div>
                 <p className="text-[9px] text-muted-foreground italic mt-1 pt-1 border-t border-violet-100 dark:border-violet-900/20">
                   * Calculations skip Fridays as per organization policy.
                 </p>
               </div>
             )}

             <div className="space-y-2">
                <Label className="text-xs font-bold dark:text-slate-300">Leave Type</Label>
                <Select value={leaveForm.type} onValueChange={v => setLeaveForm({...leaveForm, type: v})} disabled={saving}>
                   <SelectTrigger className="dark:bg-slate-900 dark:border-slate-800"><SelectValue /></SelectTrigger>
                   <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                      <SelectItem value="annual_leave">Annual Leave</SelectItem>
                      <SelectItem value="sick_leave">Sick Leave</SelectItem>
                      <SelectItem value="frl">FRL</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                   </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <Label className="text-xs font-bold dark:text-slate-300">Reason / Note (Optional)</Label>
                <Textarea 
                 value={leaveForm.reason} 
                 onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})}
                 placeholder="Provide more context for your request..."
                 rows={3}
                 disabled={saving}
                 className="dark:bg-slate-900 dark:border-slate-800"
                />
             </div>
             <DialogFooter className="pt-2 flex-row gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsLeaveModalOpen(false)} className="flex-1 dark:hover:bg-slate-800" disabled={saving}>Cancel</Button>
                <Button type="submit" className="flex-1 shadow-lg shadow-primary/20" disabled={saving}>
                   {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : editingLeave ? 'Update' : 'Submit'}
                </Button>
             </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Leave Review Modal (Manager) */}
      <Dialog open={isReviewModalOpen} onOpenChange={(open) => { 
        if (!saving) {
          setIsReviewModalOpen(open);
          if (!open) { setReviewingLeave(null); forceUnlockUI(); }
        }
      }}>
        <DialogContent className="w-[95vw] max-w-md p-6 rounded-2xl dark:bg-slate-950 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100">Review Leave Request</DialogTitle>
            <DialogDescription>
              {reviewForm.status === 'approved' ? 'Approve' : 'Reject'} request from {reviewingLeave?.full_name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReviewLeave} className="space-y-4 pt-4">
             <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-800 text-xs space-y-2">
                <div className="flex justify-between">
                   <span className="text-muted-foreground uppercase font-bold tracking-widest text-[9px]">Type</span>
                   <span className="font-bold capitalize dark:text-slate-200">{reviewingLeave?.leave_type.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                   <span className="text-muted-foreground uppercase font-bold tracking-widest text-[9px]">Dates</span>
                   <span className="font-bold dark:text-slate-200">
                     {reviewingLeave && new Date(reviewingLeave.start_date).toLocaleDateString()} — {reviewingLeave && new Date(reviewingLeave.end_date).toLocaleDateString()}
                   </span>
                </div>
                <div className="flex justify-between">
                   <span className="text-muted-foreground uppercase font-bold tracking-widest text-[9px]">Return</span>
                   <span className="font-bold text-emerald-600 dark:text-emerald-400">
                     {reviewingLeave && new Date(reviewingLeave.return_date).toLocaleDateString()}
                   </span>
                </div>
                <div className="flex justify-between">
                   <span className="text-muted-foreground uppercase font-bold tracking-widest text-[9px]">Duration</span>
                   <span className="font-bold text-primary">{reviewingLeave?.number_of_days} Business Days</span>
                </div>
             </div>
             <div className="space-y-2">
                <Label className="text-xs font-bold dark:text-slate-300">Manager Reason / Feedback</Label>
                <Textarea 
                 value={reviewForm.reason} 
                 onChange={e => setReviewForm({...reviewForm, reason: e.target.value})}
                 placeholder="Explain your decision..."
                 rows={4}
                 required
                 disabled={saving}
                 className="dark:bg-slate-900 dark:border-slate-800"
                />
             </div>
             <DialogFooter className="pt-2 flex-row gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsReviewModalOpen(false)} className="flex-1 dark:hover:bg-slate-800" disabled={saving}>Cancel</Button>
                <Button type="submit" className={cn(
                  "flex-1 shadow-lg shadow-black/10",
                  reviewForm.status === 'approved' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'
                )} disabled={saving}>
                   {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : reviewForm.status === 'approved' ? 'Approve' : 'Reject'}
                </Button>
             </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskDashboardCard({ task, compact = false }: { task: any, compact?: boolean }) {
  const taskProgress = task.progress_mode === 'manual' ? (task.manual_progress || 0) : (task.calculated_progress || 0);
  
  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden dark:bg-slate-900">
      <CardContent className={cn("flex items-center gap-4", compact ? "p-3" : "p-4")}>
        <div className={cn(
          "w-1 h-10 md:h-12 rounded-full shrink-0",
          task.priority === 'urgent' ? 'bg-rose-500' : task.priority === 'high' ? 'bg-amber-500' : 'bg-primary'
        )} />
        <div className="flex-1 min-w-0">
          <Link href={`/tasks?taskId=${task.id}`} className="hover:text-primary transition-colors">
            <h3 className={cn("font-bold truncate dark:text-slate-100", compact ? "text-xs" : "text-sm md:text-base")}>{task.title}</h3>
          </Link>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" /> {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
            </p>
            {!compact && task.sub_workspace_name && (
              <Badge variant="secondary" className="text-[8px] h-3.5 px-1 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-none">{task.sub_workspace_name}</Badge>
            )}
          </div>
        </div>
        {!compact && (
          <div className="text-right shrink-0">
            <p className="text-[10px] font-bold text-primary mb-1">{Math.round(taskProgress)}%</p>
            <Progress value={taskProgress} className="w-16 h-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
