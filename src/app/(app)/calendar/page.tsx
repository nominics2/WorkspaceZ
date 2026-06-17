"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, Loader2, Clock, Calendar as CalendarIcon, User, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function CalendarPage() {
  const { activeWorkspace } = useWorkspace();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [tasks, setTasks] = useState<any[]>([]);
  const [subWorkspaces, setSubWorkspaces] = useState<any[]>([]);
  const [teamFilter, setTeamFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
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

  const fetchData = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const [tasksRes, teamsRes] = await Promise.all([
        supabase
          .from('calendar_tasks_view')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .not('due_date', 'is', null)
          .order('due_date', { ascending: true }),
        supabase
          .from('sub_workspaces')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .order('name', { ascending: true })
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (teamsRes.error) throw teamsRes.error;

      setTasks(tasksRes.data || []);
      setSubWorkspaces(teamsRes.data || []);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error fetching data", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, supabase, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDetail = (task: any) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  // Filter tasks based on selected team and selected date
  const filteredTasks = tasks.filter(task => {
    if (teamFilter !== "all" && task.sub_workspace_id !== teamFilter) {
      if (teamFilter === "none" && task.sub_workspace_id) return false;
      if (teamFilter !== "none" && task.sub_workspace_id !== teamFilter) return false;
    }
    return true;
  });

  const selectedDateTasks = filteredTasks.filter(task => {
    if (!date || !task.due_date) return false;
    const taskDate = new Date(task.due_date);
    return (
      taskDate.getDate() === date.getDate() &&
      taskDate.getMonth() === date.getMonth() &&
      taskDate.getFullYear() === date.getFullYear()
    );
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">Keep track of your team deadlines</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border">
           <Layout className="w-4 h-4 text-muted-foreground" />
           <Select value={teamFilter} onValueChange={setTeamFilter}>
             <SelectTrigger className="w-[180px] border-none shadow-none focus:ring-0">
               <SelectValue placeholder="All Teams" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Teams</SelectItem>
               <SelectItem value="none">No Team</SelectItem>
               {subWorkspaces.map(team => (
                 <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
               ))}
             </SelectContent>
           </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-xl">
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border-none w-full"
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
                month: "space-y-4 w-full",
                table: "w-full border-collapse space-y-1",
                head_row: "flex justify-around",
                row: "flex w-full mt-2 justify-around",
                day: "h-14 w-14 p-0 font-normal aria-selected:opacity-100 hover:bg-primary/10 rounded-xl transition-all flex items-center justify-center",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-xl",
                day_today: "bg-accent text-accent-foreground font-bold",
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">
            {date ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'Deadlines'}
          </h2>
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : selectedDateTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4">No tasks due on this day.</p>
            ) : (
              selectedDateTasks.map((task) => (
                <Card 
                  key={task.id} 
                  className="border-none shadow-sm hover:translate-x-1 transition-transform cursor-pointer"
                  onClick={() => handleOpenDetail(task)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-bold text-sm line-clamp-1">{task.title}</p>
                      <div className="flex items-center gap-2">
                         <span className={cn(
                           "text-[10px] font-bold uppercase",
                           task.is_overdue ? "text-rose-500" : "text-muted-foreground"
                         )}>
                           {task.is_overdue ? "Overdue" : task.status}
                         </span>
                         {task.sub_workspace_name && (
                           <Badge variant="secondary" className="text-[8px] bg-violet-50 text-violet-600 border-none px-1 h-3.5">
                             {task.sub_workspace_name}
                           </Badge>
                         )}
                      </div>
                    </div>
                    <Badge className={
                      task.priority?.toLowerCase() === 'urgent' ? 'bg-rose-500' : 
                      task.priority?.toLowerCase() === 'high' ? 'bg-amber-500' : 'bg-primary'
                    }>
                      {task.priority}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="pt-6 border-t">
             <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Upcoming {teamFilter !== 'all' ? 'Team' : ''}</h3>
             <div className="space-y-3">
                {filteredTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-start gap-3 group cursor-pointer" onClick={() => handleOpenDetail(task)}>
                    <div className={cn(
                      "w-1 h-8 rounded-full shrink-0",
                      task.priority?.toLowerCase() === 'urgent' ? "bg-rose-500" : "bg-primary/20"
                    )} />
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold group-hover:text-primary transition-colors truncate">{task.title}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-muted-foreground">{new Date(task.due_date).toLocaleDateString()}</p>
                        {task.sub_workspace_name && (
                           <span className="text-[8px] text-violet-500 font-bold uppercase">{task.sub_workspace_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* Task Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={(open) => {
        setIsDetailOpen(open);
        if (!open) forceUnlockUI();
      }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedTask && (
            <div className="space-y-8 pt-6">
              <SheetHeader>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className="capitalize">{selectedTask.priority}</Badge>
                  <Badge variant="secondary" className="capitalize">{selectedTask.status?.replace('_', ' ')}</Badge>
                  {selectedTask.sub_workspace_name && (
                    <Badge variant="secondary" className="bg-violet-50 text-violet-600 border-none">{selectedTask.sub_workspace_name}</Badge>
                  )}
                </div>
                <SheetTitle className="text-2xl font-bold">{selectedTask.title}</SheetTitle>
                <SheetDescription>{selectedTask.description || 'No description provided.'}</SheetDescription>
              </SheetHeader>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl">
                   <div className="space-y-1">
                     <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Due Date</p>
                     <p className="text-sm font-medium flex items-center gap-2">
                       <CalendarIcon className="w-3.5 h-3.5" />
                       {new Date(selectedTask.due_date).toLocaleDateString()}
                     </p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assigned To</p>
                     <p className="text-sm font-medium flex items-center gap-2">
                       <User className="w-3.5 h-3.5" />
                       {selectedTask.assigned_to_name || 'Unassigned'}
                     </p>
                   </div>
                </div>

                <div className="space-y-3">
                   <div className="flex items-center justify-between mb-2">
                     <span className="text-sm font-bold">Progress</span>
                     <span className="text-xs font-bold text-primary">{Math.round(selectedTask.calculated_progress || 0)}%</span>
                   </div>
                   <Progress value={selectedTask.calculated_progress || 0} className="h-2" />
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
