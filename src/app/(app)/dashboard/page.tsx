
"use client";

import { useEffect, useState } from "react";
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
  Bell
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function DashboardPage() {
  const { activeWorkspace, userProfile } = useWorkspace();
  const [stats, setStats] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!activeWorkspace) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch Summary Stats
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

        // Fetch My Tasks (Upcoming)
        const { data: myTasks } = await supabase
          .from('my_tasks_view')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .order('due_date', { ascending: true })
          .limit(5);
        setTasks(myTasks || []);

        // Fetch Recent Activity
        const { data: recentLogs } = await supabase
          .from('recent_activity_view')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .order('created_at', { ascending: false })
          .limit(5);
        setActivity(recentLogs || []);

        // Fetch Notifications
        const { data: notifs } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userProfile?.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(3);
        setNotifications(notifs || []);

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [activeWorkspace, userProfile?.id, supabase]);

  if (loading) {
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
      </div>

      {/* Stats Grid */}
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
        {/* Nearest Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Upcoming Tasks</h2>
            <Link href="/tasks" className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <Card className="border-none shadow-sm p-8 text-center text-muted-foreground">
                No upcoming tasks for this workspace.
              </Card>
            ) : (
              tasks.map((task) => (
                <Card key={task.id} className="border-none shadow-sm hover:shadow-md transition-shadow group">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`w-2 h-12 rounded-full ${task.priority === 'Urgent' ? 'bg-rose-500' : 'bg-primary'}`} />
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{task.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Due {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                        </p>
                        <Badge variant="secondary" className="text-[10px] py-0">{task.status}</Badge>
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
        </div>

        {/* Productivity & Activity */}
        <div className="space-y-8">
          {notifications.length > 0 && (
            <Card className="border-none shadow-sm border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm">Latest Notifications</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {notifications.map((n) => (
                  <div key={n.id} className="text-xs">
                    <p className="font-medium">{n.title}</p>
                    <p className="text-muted-foreground">{n.message}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {activity.length === 0 ? (
                <p className="text-xs text-muted-foreground">No recent activity found.</p>
              ) : (
                activity.map((log) => (
                  <div key={log.id} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm text-foreground">
                        <span className="font-bold">{log.actor_name}</span> {log.action_description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
