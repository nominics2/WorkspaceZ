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
  Paperclip
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [newReminder, setNewReminder] = useState({ title: "", remindAt: "" });
  
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
      // 1. Fetch Summary View
      const { data: summary } = await supabase
        .from('dashboard_task_summary_view')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .maybeSingle();

      // 2. Fetch My Tasks
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
        { label: "Active", count: activeTasks.length, icon: Clock, color: "text-blue-500", bg: "bg-blue-50" },
        { label: "Due Soon", count: dueSoonTasks.length, icon: CalendarDays, color: "text-amber-500", bg: "bg-amber-50" },
        { label: "Overdue", count: overdueTasks.length, icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50" },
        { label: "Completed", count: completedTasks.length, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
      ]);

      setTasks(myTasks || []);

      // 3. Activity Feed
      const { data: recentLogs } = await supabase
        .from('recent_activity_view')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setActivity(recentLogs || []);

      // 4. Notifications
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userProfile.id)
        .eq('is_read', false)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(5);
      setNotifications(notifs || []);

      // 5. Reminders
      const { data: rems } = await supabase
        .from('reminders')
        .select('*')
        .eq('remind_to', userProfile.id)
        .eq('is_completed', false)
        .order('remind_at', { ascending: true })
        .limit(5);
      setReminders(rems || []);

      // 6. Workload
      if (userRole === 'superadmin' || hasPermission('view_admin_panel') || hasPermission('view_all_tasks')) {
        const { data: work } = await supabase
          .from('member_workload_view')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .order('active_tasks', { ascending: false });
        setWorkload(work || []);
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

  const overdueList = useMemo(() => tasks.filter(t => t.is_overdue && t.status !== 'completed'), [tasks]);
  const dueSoonList = useMemo(() => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 3);
    const today = new Date();
    return tasks.filter(t => {
      if (!t.due_date || t.status === 'completed') return false;
      const due = new Date(t.due_date);
      return due <= soon && due > today;
    });
  }, [tasks]);

  if (loading && stats.length === 0) {
    return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const isAdmin = userRole === 'superadmin' || userRole === 'admin';

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Hello, {userProfile?.full_name?.split(' ')[0] || 'User'}</h1>
          <p className="text-sm text-muted-foreground">Here's what's happening in {activeWorkspace?.name} today.</p>
        </div>
        <div className="flex items-center gap-2">
           {isAdmin && (
             <Button variant="outline" size="sm" onClick={handleRunNotificationChecks} disabled={isRunningChecks} className="h-9 gap-2">
               {isRunningChecks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
               <span className="hidden sm:inline">Run Checks</span>
             </Button>
           )}
           <Button onClick={() => setIsReminderModalOpen(true)} size="sm" className="h-9 gap-2">
             <Clock className="w-4 h-4" /> Quick Reminder
           </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm">
            <CardContent className="p-4 md:p-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl md:text-2xl font-bold mt-1">{stat.count}</p>
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
          {/* Quick Actions */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Task", icon: CheckSquare, href: "/tasks", color: "bg-blue-500" },
                { label: "Note", icon: StickyNote, href: "/notes", color: "bg-amber-500" },
                { label: "Chat", icon: MessageSquare, href: "/chat", color: "bg-emerald-500" },
                { label: "Checkup", icon: Zap, onClick: handleRunNotificationChecks, color: "bg-violet-500", admin: true },
              ].map((action) => {
                if (action.admin && !isAdmin) return null;
                const Content = (
                  <Card className="border-none shadow-sm hover:translate-y-[-2px] transition-all cursor-pointer group">
                    <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
                      <div className={cn("p-3 rounded-xl text-white shadow-lg shadow-black/10", action.color)}>
                        <action.icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold">{action.label}</span>
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
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                Assigned to Me: Today
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {todaysTasks.length === 0 ? (
                <div className="p-10 text-center bg-slate-50 rounded-2xl border-2 border-dashed flex flex-col items-center gap-2">
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

          {/* Overdue & Soon */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase text-rose-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Overdue
              </h3>
              <div className="space-y-3">
                {overdueList.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-4 bg-slate-50 rounded-xl">Nothing overdue.</p>
                ) : (
                  overdueList.map(task => <TaskDashboardCard key={task.id} task={task} compact />)
                )}
              </div>
            </section>
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase text-amber-500 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Due Soon
              </h3>
              <div className="space-y-3">
                {dueSoonList.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-4 bg-slate-50 rounded-xl">No urgent deadlines.</p>
                ) : (
                  dueSoonList.map(task => <TaskDashboardCard key={task.id} task={task} compact />)
                )}
              </div>
            </section>
          </div>

          {/* Activity Feed */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold">Recent Activity</h2>
            <Card className="border-none shadow-sm">
              <CardContent className="p-0">
                <div className="divide-y">
                  {activity.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic text-center py-10">No recent activity yet.</p>
                  ) : (
                    activity.map((log) => {
                      const config = activityConfig[log.action] || { 
                        label: log.action_description || log.action?.replace(/_/g, ' ') || "performed an action", 
                        icon: TrendingUp, 
                        color: "text-slate-500", 
                        bg: "bg-slate-100" 
                      };
                      const ActionIcon = config.icon;
                      
                      // Identity mapping
                      const actorName = log.actor_full_name || log.actor_username || log.actor_email || "Someone";
                      const avatarSrc = log.actor_avatar_preset ? `/avatars/${log.actor_avatar_preset}.png` : log.actor_avatar_url;
                      
                      // Target mapping
                      const targetTitle = log.task_title || log.note_title || "";

                      return (
                        <div key={log.id} className="p-4 flex gap-4 group hover:bg-slate-50 transition-colors">
                          <div className="relative shrink-0">
                            <Avatar className="w-10 h-10 border shadow-sm">
                              <AvatarImage src={avatarSrc} />
                              <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                                {actorName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className={cn(
                              "absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm",
                              config.bg
                            )}>
                              <ActionIcon className="w-2.5 h-2.5 text-white" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs md:text-sm text-foreground leading-relaxed">
                              <span className="font-bold">{actorName}</span> {config.label}
                              {targetTitle && <span className="font-bold ml-1 text-primary">"{targetTitle}"</span>}
                            </p>
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
          <Card className="border-none shadow-sm bg-violet-50/50">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-violet-600" />
                  <CardTitle className="text-sm">My Reminders</CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] h-4 bg-white border-violet-200">{reminders.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              {reminders.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">No active reminders.</p>
              ) : (
                reminders.map((r) => (
                  <div key={r.id} className="bg-white p-3 rounded-xl border shadow-sm flex items-center justify-between group animate-in slide-in-from-right-2">
                    <div className="space-y-0.5 overflow-hidden">
                      <p className="text-xs font-bold truncate">{r.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.remind_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500 hover:bg-emerald-50" onClick={() => handleCompleteReminder(r.id)}>
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-none shadow-sm">
            <CardHeader className="p-4 pb-2 border-b">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm">Latest Alerts</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {notifications.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic p-4 text-center">All caught up!</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-4 text-xs group relative hover:bg-slate-50 transition-colors">
                      <p className="font-bold truncate pr-6">{n.title}</p>
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
            <Card className="border-none shadow-sm">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm">Team Workload</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-4">
                {workload.map((w, index) => (
                  <div key={w.user_id || `${w.email}-${index}`} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold truncate max-w-[120px]">{w.full_name || w.email || "Unknown Member"}</span>
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

      <Dialog open={isReminderModalOpen} onOpenChange={(open) => { 
        if (!saving) {
          setIsReminderModalOpen(open);
          if (!open) forceUnlockUI();
        }
      }}>
        <DialogContent className="w-[95vw] max-w-md p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle>Quick Reminder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateReminder} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold">What should we remind you about?</Label>
              <Input 
                value={newReminder.title} 
                onChange={e => setNewReminder({...newReminder, title: e.target.value})} 
                placeholder="e.g. Follow up on proposal"
                required
                disabled={saving}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">When?</Label>
              <Input 
                type="datetime-local"
                value={newReminder.remindAt} 
                onChange={e => setNewReminder({...newReminder, remindAt: e.target.value})} 
                required
                disabled={saving}
                className="h-11"
              />
            </div>
            <DialogFooter className="flex flex-row gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsReminderModalOpen(false)} className="flex-1" disabled={saving}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set Reminder"}
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
    <Card className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden">
      <CardContent className={cn("flex items-center gap-4", compact ? "p-3" : "p-4")}>
        <div className={cn(
          "w-1 h-10 md:h-12 rounded-full shrink-0",
          task.priority === 'urgent' ? 'bg-rose-500' : task.priority === 'high' ? 'bg-amber-500' : 'bg-primary'
        )} />
        <div className="flex-1 min-w-0">
          <Link href={`/tasks?taskId=${task.id}`} className="hover:text-primary transition-colors">
            <h3 className={cn("font-bold truncate", compact ? "text-xs" : "text-sm md:text-base")}>{task.title}</h3>
          </Link>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" /> {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
            </p>
            {!compact && task.sub_workspace_name && (
              <Badge variant="secondary" className="text-[8px] h-3.5 px-1 bg-violet-50 text-violet-600 border-none">{task.sub_workspace_name}</Badge>
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
