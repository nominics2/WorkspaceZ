"use client";

import { useEffect, useState, useCallback } from "react";
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
  Plus
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

export default function DashboardPage() {
  const { activeWorkspace, userProfile } = useWorkspace();
  const [stats, setStats] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const { data: summary } = await supabase
        .from('dashboard_task_summary_view')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .maybeSingle();

      setStats([
        { label: "To-do", count: summary?.todo_count || 0, icon: Clock, color: "text-blue-500", bg: "bg-blue-50" },
        { label: "Ongoing", count: summary?.in_progress_count || 0, icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-50" },
        { label: "Completed", count: summary?.completed_count || 0, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
        { label: "Overdue", count: summary?.overdue_count || 0, icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50" },
      ]);

      const { data: myTasks } = await supabase
        .from('my_tasks_view')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('due_date', { ascending: true })
        .limit(5);
      setTasks(myTasks || []);

      const { data: recentLogs } = await supabase
        .from('recent_activity_view')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setActivity(recentLogs || []);

      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userProfile?.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(3);
      setNotifications(notifs || []);

      const { data: rems } = await supabase
        .from('reminders')
        .select('*')
        .eq('remind_to', userProfile?.id)
        .eq('is_completed', false)
        .order('remind_at', { ascending: true })
        .limit(5);
      setReminders(rems || []);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, userProfile?.id, supabase]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleMarkNotifRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error(err);
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
      await supabase.from('reminders').update({ 
        is_completed: true,
        completed_at: new Date().toISOString()
      }).eq('id', id);
      toast({ title: "Reminder completed" });
      fetchDashboardData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  if (loading && stats.length === 0) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Welcome back, {userProfile?.full_name?.split(' ')[0] || 'User'} 👋</h1>
          <p className="text-sm text-muted-foreground">Quick overview for {activeWorkspace?.name}.</p>
        </div>
        <Button onClick={() => setIsReminderModalOpen(true)} size="sm" className="w-full md:w-auto flex items-center gap-2 h-10 md:h-9">
          <Clock className="w-4 h-4" /> Quick Reminder
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm">
            <CardContent className="p-4 md:p-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-sm font-medium text-muted-foreground uppercase md:capitalize">{stat.label}</p>
                <p className="text-xl md:text-2xl font-bold mt-0.5">{stat.count}</p>
              </div>
              <div className={`p-2 md:p-3 rounded-xl ${stat.bg} hidden sm:block`}>
                <stat.icon className={`w-5 h-5 md:w-6 md:h-6 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold">Upcoming Tasks</h2>
              <Link href="/tasks" className="text-xs md:text-sm font-medium text-primary flex items-center gap-1 hover:underline">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="space-y-3">
              {tasks.length === 0 ? (
                <Card className="border-none shadow-sm p-8 text-center text-muted-foreground italic text-sm">
                  No upcoming tasks.
                </Card>
              ) : (
                tasks.map((task) => {
                  const taskProgress = task.progress_mode === 'manual' ? (task.manual_progress || 0) : (task.calculated_progress || 0);
                  return (
                    <Card key={task.id} className="border-none shadow-sm hover:shadow-md transition-shadow group">
                      <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
                        <div className={`w-1 md:w-1.5 h-10 md:h-12 rounded-full shrink-0 ${task.priority === 'urgent' ? 'bg-rose-500' : 'bg-primary'}`} />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm md:text-base text-foreground group-hover:text-primary transition-colors truncate">{task.title}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                            </p>
                            <Badge variant="secondary" className="text-[9px] py-0 px-1 capitalize h-3.5">{task.status}</Badge>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">
                            {Math.round(taskProgress)}%
                          </p>
                          <Progress value={taskProgress} className="w-12 md:w-16 h-1" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg md:text-xl font-bold">Recent Activity</h2>
            <Card className="border-none shadow-sm">
              <CardContent className="p-4 md:p-6 space-y-5">
                {activity.length === 0 ? (
                  <p className="text-xs md:text-sm text-muted-foreground italic text-center py-4">No recent activity.</p>
                ) : (
                  activity.map((log) => (
                    <div key={log.id} className="flex gap-3 md:gap-4 group">
                      <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                        <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500 group-hover:text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-foreground leading-relaxed">
                          <span className="font-bold">{log.actor_name}</span> {log.action_description}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(log.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        <div className="space-y-6 md:space-y-8">
          <Card className="border-none shadow-sm bg-slate-50">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm">Reminders</CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] h-4">{reminders.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {reminders.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">No active reminders.</p>
              ) : (
                reminders.map((r) => (
                  <div key={r.id} className="bg-white p-3 rounded-lg border shadow-sm flex items-center justify-between group">
                    <div className="space-y-0.5 overflow-hidden">
                      <p className="text-xs font-bold truncate">{r.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.remind_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-emerald-500"
                      onClick={() => handleCompleteReminder(r.id)}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm">Notifications</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              {notifications.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">All caught up!</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="text-xs group relative pr-6">
                    <p className="font-bold truncate">{n.title}</p>
                    <p className="text-muted-foreground leading-relaxed line-clamp-2">{n.message}</p>
                    <button 
                      onClick={() => handleMarkNotifRead(n.id)}
                      className="absolute right-0 top-0 text-primary p-1 md:opacity-0 md:group-hover:opacity-100"
                      title="Mark as read"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
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
              <Label className="text-xs font-bold">Reminder Title</Label>
              <Input 
                value={newReminder.title} 
                onChange={e => setNewReminder({...newReminder, title: e.target.value})} 
                placeholder="e.g. Follow up on proposal"
                required
                disabled={saving}
                className="h-11 text-base md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Remind At</Label>
              <Input 
                type="datetime-local"
                value={newReminder.remindAt} 
                onChange={e => setNewReminder({...newReminder, remindAt: e.target.value})} 
                required
                disabled={saving}
                className="h-11 text-base md:text-sm"
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
