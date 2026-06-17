
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
  Loader2
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const { activeWorkspace, userProfile } = useWorkspace();
  const [stats, setStats] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
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
          .single();

        if (summary) {
          setStats([
            { label: "To-do", count: summary.todo_count || 0, icon: Clock, color: "text-blue-500", bg: "bg-blue-50" },
            { label: "Ongoing", count: summary.in_progress_count || 0, icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-50" },
            { label: "Completed", count: summary.completed_count || 0, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
            { label: "Overdue", count: summary.overdue_count || 0, icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50" },
          ]);
        }

        // Fetch My Tasks
        const { data: myTasks } = await supabase
          .from('my_tasks_view')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .limit(5);
        setTasks(myTasks || []);

        // Fetch Recent Activity
        const { data: recentLogs } = await supabase
          .from('recent_activity_view')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .limit(3);
        setActivity(recentLogs || []);

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [activeWorkspace]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Welcome back, {userProfile?.full_name || 'User'} 👋</h1>
        <p className="text-muted-foreground">Here is what's happening in {activeWorkspace?.name} today.</p>
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
            <button className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No upcoming tasks.</p>
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
                      <p className="text-xs font-medium text-muted-foreground mb-1">{task.calculated_progress || task.manual_progress || 0}%</p>
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
          <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative">
            <CardHeader>
              <CardTitle className="text-lg">Workspace Health</CardTitle>
              <CardDescription className="text-white/80">Overall task completion progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-4">
                {stats.find(s => s.label === "Completed")?.count || 0}
              </div>
              <Progress value={50} className="h-2 bg-white/20" />
            </CardContent>
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <LayoutDashboard className="w-32 h-32" />
            </div>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {activity.length === 0 ? (
                <p className="text-xs text-muted-foreground">No recent activity.</p>
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
