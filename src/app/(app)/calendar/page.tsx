"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, Loader2, Clock, Calendar as CalendarIcon, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export default function CalendarPage() {
  const { activeWorkspace } = useWorkspace();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();

  const fetchCalendarTasks = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('calendar_tasks_view')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error fetching calendar", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, supabase, toast]);

  useEffect(() => {
    fetchCalendarTasks();
  }, [fetchCalendarTasks]);

  const handleOpenDetail = (task: any) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  // Filter tasks for the selected date
  const selectedDateTasks = tasks.filter(task => {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">Keep track of your deadlines</p>
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
             <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">All Upcoming</h3>
             <div className="space-y-3">
                {tasks.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-start gap-3 group cursor-pointer" onClick={() => handleOpenDetail(task)}>
                    <div className={cn(
                      "w-1 h-8 rounded-full shrink-0",
                      task.priority?.toLowerCase() === 'urgent' ? 'bg-rose-500' : 'bg-primary/20'
                    )} />
                    <div>
                      <p className="text-xs font-bold group-hover:text-primary transition-colors">{task.title}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(task.due_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* Task Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedTask && (
            <div className="space-y-8 pt-6">
              <SheetHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="capitalize">{selectedTask.priority}</Badge>
                  <Badge variant="secondary" className="capitalize">{selectedTask.status?.replace('_', ' ')}</Badge>
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
                     <Label className="text-sm font-bold">Progress</Label>
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

function Label({ children, className }: { children: React.ReactNode, className?: string }) {
  return <span className={cn("text-sm font-medium", className)}>{children}</span>;
}
