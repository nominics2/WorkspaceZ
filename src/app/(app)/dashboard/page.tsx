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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Welcome back, {userProfile?.full_name || 'User'} 👋</h1>
          <p className="text-muted-foreground">Here is what's happening in {activeWorkspace?.name} today.</p>
        </div>
        <Button onClick={() => setIsReminderModalOpen(true)} className="flex items-center gap-2">
          <Clock className="w-4 h-4" /> Quick Reminder
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.count}</p>
              </div>
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Upcoming Tasks</h2>
              <Link href="/tasks" className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="space-y-3">
              {tasks.length === 0 ? (
                <Card className="border-none shadow-sm p-8 text-center text-muted-foreground italic">
                  No upcoming tasks.
                </Card>
              ) : (
                tasks.map((task) => (
                  <Card key={task.id} className="border-none shadow-sm hover:shadow-md transition-shadow group">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={`w-2 h-12 rounded-full ${task.priority === 'urgent' ? 'bg-rose-500' : 'bg-primary'}`} />
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{task.title}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Due {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                          </p>
                          <Badge variant="secondary" className="text-[10px] py-0 capitalize">{task.status}</Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {Math.round(task.calculated_progress || task.manual_progress || 0)}%
                        </p>
                        <Progress value={task.calculated_progress || task.manual_progress || 0} className="w-20 h-1.5" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold">Recent Activity</h2>
            <Card className="border-none shadow-sm">
              <CardContent className="p-6 space-y-6">
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-4">No recent activity.</p>
                ) : (
                  activity.map((log) => (
                    <div key={log.id} className="flex gap-4 group">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                        <TrendingUp className="w-4 h-4 text-slate-500 group-hover:text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-foreground">
                          <span className="font-bold">{log.actor_name}</span> {log.action_description}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-sm bg-slate-50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm">Reminders</CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px]">{reminders.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {reminders.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">No active reminders.</p>
              ) : (
                reminders.map((r) => (
                  <div key={r.id} className="bg-white p-3 rounded-lg border shadow-sm flex items-center justify-between group">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold">{r.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.remind_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-emerald-500"
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
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm">Latest Notifications</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">All caught up!</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="text-xs group relative pr-6">
                    <p className="font-bold">{n.title}</p>
                    <p className="text-muted-foreground leading-relaxed">{n.message}</p>
                    <button 
                      onClick={() => handleMarkNotifRead(n.id)}
                      className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 text-primary p-1"
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Quick Reminder</DialogTitle>
            <DialogDescription>Get notified about important moments.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateReminder} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reminder Title</Label>
              <Input 
                value={newReminder.title} 
                onChange={e => setNewReminder({...newReminder, title: e.target.value})} 
                placeholder="e.g. Call client"
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Remind At</Label>
              <Input 
                type="datetime-local"
                value={newReminder.remindAt} 
                onChange={e => setNewReminder({...newReminder, remindAt: e.target.value})} 
                required
                disabled={saving}
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => { setIsReminderModalOpen(false); forceUnlockUI(); }} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Set Reminder
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
