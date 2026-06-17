
"use client";

import { useEffect, useState } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Paperclip,
  Calendar as CalendarIcon,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function TasksPage() {
  const { activeWorkspace } = useWorkspace();
  const [tasks, setTasks] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!activeWorkspace) return;

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('my_tasks_view')
          .select('*')
          .eq('workspace_id', activeWorkspace.id);
        
        if (error) throw error;
        setTasks(data || []);
      } catch (err) {
        console.error('Error fetching tasks:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [activeWorkspace]);

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">Manage and track your project assignments</p>
        </div>
        <Button className="flex items-center gap-2 py-6 px-6 shadow-lg shadow-primary/20">
          <Plus className="w-5 h-5" /> New Task
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            className="pl-10 border-none shadow-none focus-visible:ring-0" 
            placeholder="Search tasks..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="ghost" className="flex items-center gap-2">
          <Filter className="w-4 h-4" /> Filter
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredTasks.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">No tasks found.</p>
        ) : (
          filteredTasks.map((task) => (
            <Card key={task.id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  <div className={cn(
                    "w-full md:w-1.5 h-1.5 md:h-auto",
                    task.priority === 'Urgent' ? "bg-rose-500" : 
                    task.priority === 'High' ? "bg-amber-500" : "bg-primary"
                  )} />
                  <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{task.title}</h3>
                        <Badge variant="outline" className="text-[10px] rounded-sm">{task.priority}</Badge>
                        {task.sub_workspace_name && (
                           <Badge variant="secondary" className="text-[10px] bg-slate-100">{task.sub_workspace_name}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                    </div>

                    <div className="flex items-center gap-8 min-w-[300px]">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" /> Due {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 border flex items-center justify-center">
                            <span className="text-[10px] font-bold">
                              {task.assigned_to_name?.[0] || '?'}
                            </span>
                          </div>
                          <span className="text-xs text-foreground font-medium">{task.assigned_to_name || 'Unassigned'}</span>
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Progress</span>
                          <span className="text-xs font-bold text-primary">{task.calculated_progress || task.manual_progress || 0}%</span>
                        </div>
                        <Progress value={task.calculated_progress || task.manual_progress || 0} className="h-1.5" />
                      </div>

                      <div className="flex items-center gap-4 text-muted-foreground">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Edit Task</DropdownMenuItem>
                            <DropdownMenuItem className="text-emerald-600">Mark Completed</DropdownMenuItem>
                            <DropdownMenuItem className="text-rose-600">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
