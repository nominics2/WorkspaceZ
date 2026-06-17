"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  LayoutDashboard, 
  TrendingUp,
  ArrowRight
} from "lucide-react";
import { MOCK_USER, MOCK_TASKS, TASK_STATUS } from "@/lib/mock-data";

export default function DashboardPage() {
  const stats = [
    { label: "To-do", count: 12, icon: Clock, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Ongoing", count: 5, icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-50" },
    { label: "Completed", count: 48, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
    { label: "Overdue", count: 2, icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Welcome back, {MOCK_USER.name} 👋</h1>
        <p className="text-muted-foreground">Here is what's happening in your workspace today.</p>
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
            {MOCK_TASKS.map((task) => (
              <Card key={task.id} className="border-none shadow-sm hover:shadow-md transition-shadow group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-2 h-12 rounded-full ${task.priority === 'Urgent' ? 'bg-rose-500' : 'bg-primary'}`} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{task.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Due {task.dueDate}
                      </p>
                      <Badge variant="secondary" className="text-[10px] py-0">{task.status}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{task.progress}%</p>
                    <Progress value={task.progress} className="w-20 h-1.5" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Productivity & Activity */}
        <div className="space-y-8">
          <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative">
            <CardHeader>
              <CardTitle className="text-lg">Productivity Score</CardTitle>
              <CardDescription className="text-white/80">You're doing great this week!</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-4">84%</div>
              <Progress value={84} className="h-2 bg-white/20" />
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
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground">
                      <span className="font-bold">Alex Johnson</span> updated task <span className="font-medium text-primary cursor-pointer hover:underline">Dashboard v2</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}