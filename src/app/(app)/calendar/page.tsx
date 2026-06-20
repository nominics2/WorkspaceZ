
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar as CalendarIcon, User, Layout, Filter, FilterX, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export default function CalendarPage() {
  const { activeWorkspace } = useWorkspace();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [tasks, setTasks] = useState<any[]>([]);
  const [subWorkspaces, setSubWorkspaces] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  const [filters, setFilters] = useState({
    teamId: "all",
    assignedTo: "all",
    status: [] as string[],
    priority: [] as string[]
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

  const fetchData = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const [tasksRes, teamsRes] = await Promise.all([
        supabase
          .from('my_tasks_view')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .eq('is_deleted', false)
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

      // Fetch members in two steps to avoid profile relationship ambiguity
      const { data: mData, error: mErr } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', activeWorkspace.id)
        .eq('status', 'active');
      
      if (mErr) throw mErr;

      let enrichedMembers = [];
      if (mData && mData.length > 0) {
        const uids = mData.map(m => m.user_id);
        const { data: pData, error: pErr } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', uids);
        
        if (pErr) throw pErr;

        enrichedMembers = mData.map(m => ({
          ...m,
          profiles: pData?.find(p => p.id === m.user_id) || null
        }));
      }

      setTasks(tasksRes.data || []);
      setSubWorkspaces(teamsRes.data || []);
      setMembers(enrichedMembers);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error fetching data", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, supabase, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filters.teamId !== "all") {
        if (filters.teamId === "none" && task.sub_workspace_id) return false;
        if (filters.teamId !== "none" && task.sub_workspace_id !== filters.teamId) return false;
      }
      if (filters.assignedTo !== "all" && task.assigned_to !== filters.assignedTo) return false;
      if (filters.status.length > 0 && !filters.status.includes(task.status)) return false;
      if (filters.priority.length > 0 && !filters.priority.includes(task.priority)) return false;
      return true;
    });
  }, [tasks, filters]);

  const selectedDateTasks = useMemo(() => {
    return filteredTasks.filter(task => {
      if (!date || !task.due_date) return false;
      const taskDate = new Date(task.due_date);
      return (
        taskDate.getDate() === date.getDate() &&
        taskDate.getMonth() === date.getMonth() &&
        taskDate.getFullYear() === date.getFullYear()
      );
    });
  }, [filteredTasks, date]);

  const resetFilters = () => setFilters({
    teamId: "all",
    assignedTo: "all",
    status: [],
    priority: []
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-slate-100">Calendar</h1>
          <p className="text-muted-foreground">Keep track of your team deadlines</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border dark:border-slate-800 overflow-x-auto whitespace-nowrap">
           <Select value={filters.teamId} onValueChange={v => setFilters(f => ({...f, teamId: v}))}>
             <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs h-8 dark:text-slate-100">
               <Layout className="w-3 h-3 mr-2" />
               <SelectValue placeholder="Team" />
             </SelectTrigger>
             <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
               <SelectItem value="all">All Teams</SelectItem>
               <SelectItem value="none">No Team</SelectItem>
               {subWorkspaces.map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
             </SelectContent>
           </Select>

           <Select value={filters.assignedTo} onValueChange={v => setFilters(f => ({...f, assignedTo: v}))}>
             <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs h-8 dark:text-slate-100">
               <User className="w-3 h-3 mr-2" />
               <SelectValue placeholder="Assignee" />
             </SelectTrigger>
             <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
               <SelectItem value="all">All Users</SelectItem>
               {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{(m.profiles as any)?.full_name}</SelectItem>)}
             </SelectContent>
           </Select>

           <DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-2 border-none bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
                  <Filter className="w-3 h-3" /> Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 dark:bg-slate-900 dark:border-slate-800">
                <DropdownMenuLabel className="dark:text-slate-100">Status</DropdownMenuLabel>
                {['to_do', 'in_progress', 'completed'].map(s => (
                  <DropdownMenuCheckboxItem 
                    key={s} 
                    checked={filters.status.includes(s)}
                    onCheckedChange={c => setFilters(f => ({...f, status: c ? [...f.status, s] : f.status.filter(x => x !== s)}))}
                    className="capitalize dark:text-slate-300"
                  >
                    {s.replace('_', ' ')}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator className="dark:bg-slate-800" />
                <DropdownMenuLabel className="dark:text-slate-100">Priority</DropdownMenuLabel>
                {['low', 'medium', 'high', 'urgent'].map(p => (
                  <DropdownMenuCheckboxItem 
                    key={p} 
                    checked={filters.priority.includes(p)}
                    onCheckedChange={c => setFilters(f => ({...f, priority: c ? [...f.priority, p] : f.priority.filter(x => x !== p)}))}
                    className="capitalize dark:text-slate-300"
                  >
                    {p}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator className="dark:bg-slate-800" />
                <DropdownMenuItem onClick={resetFilters} className="text-rose-500 gap-2 dark:hover:bg-rose-500/10">
                  <FilterX className="w-3 h-3" /> Reset
                </DropdownMenuItem>
              </DropdownMenuContent>
           </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-xl overflow-hidden dark:bg-slate-900">
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
                day: "h-14 w-14 p-0 font-normal aria-selected:opacity-100 hover:bg-primary/10 rounded-xl transition-all flex items-center justify-center dark:text-slate-300",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-xl",
                day_today: "bg-accent text-accent-foreground font-bold dark:bg-accent/20 dark:text-accent-foreground",
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Clock className="w-5 h-5 text-primary" />
            {date ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'Deadlines'}
          </h2>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : selectedDateTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800">No tasks due on this day.</p>
            ) : (
              selectedDateTasks.map((task) => (
                <Card 
                  key={task.id} 
                  className="border-none shadow-sm hover:translate-x-1 transition-transform cursor-pointer group dark:bg-slate-900"
                  onClick={() => { setSelectedTask(task); setIsDetailOpen(true); }}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="space-y-1 flex-1 min-w-0 mr-4">
                      <p className="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors dark:text-slate-100">{task.title}</p>
                      <div className="flex items-center gap-2">
                         <span className={cn(
                           "text-[10px] font-bold uppercase",
                           task.is_overdue ? "text-rose-500" : "text-muted-foreground"
                         )}>
                           {task.is_overdue ? "Overdue" : task.status.replace('_', ' ')}
                         </span>
                         {task.sub_workspace_name && (
                           <Badge variant="secondary" className="text-[8px] bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-none px-1 h-3.5">
                             {task.sub_workspace_name}
                           </Badge>
                         )}
                      </div>
                    </div>
                    <Badge className={cn(
                      "text-[10px] h-5",
                      task.priority?.toLowerCase() === 'urgent' ? 'bg-rose-500' : 
                      task.priority?.toLowerCase() === 'high' ? 'bg-amber-500' : 'bg-primary'
                    )}>
                      {task.priority}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      <Sheet open={isDetailOpen} onOpenChange={(open) => { setIsDetailOpen(open); if (!open) forceUnlockUI(); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto dark:bg-slate-950 dark:border-slate-800">
          {selectedTask && (
            <div className="space-y-8 pt-6">
              <SheetHeader>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className="capitalize dark:border-slate-800 dark:text-slate-400">{selectedTask.priority}</Badge>
                  <Badge variant="secondary" className="capitalize dark:bg-slate-900 dark:text-slate-300">{selectedTask.status?.replace('_', ' ')}</Badge>
                </div>
                <SheetTitle className="text-2xl font-bold dark:text-slate-100">{selectedTask.title}</SheetTitle>
                <SheetDescription className="dark:text-slate-400">{selectedTask.description || 'No description provided.'}</SheetDescription>
              </SheetHeader>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                   <div className="space-y-1">
                     <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Due Date</p>
                     <p className="text-sm font-medium flex items-center gap-2 dark:text-slate-300">
                       <CalendarIcon className="w-3.5 h-3.5" />
                       {new Date(selectedTask.due_date).toLocaleDateString()}
                     </p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assigned To</p>
                     <p className="text-sm font-medium flex items-center gap-2 dark:text-slate-300">
                       <User className="w-3.5 h-3.5" />
                       {selectedTask.assigned_to_name || 'Unassigned'}
                     </p>
                   </div>
                </div>

                <div className="space-y-3">
                   <div className="flex items-center justify-between mb-2">
                     <span className="text-sm font-bold dark:text-slate-100">Progress ({selectedTask.progress_mode})</span>
                     <span className="text-xs font-bold text-primary">
                       {Math.round(selectedTask.progress_mode === 'manual' ? (selectedTask.manual_progress || 0) : (selectedTask.calculated_progress || 0))}%
                     </span>
                   </div>
                   <Progress 
                    value={selectedTask.progress_mode === 'manual' ? (selectedTask.manual_progress || 0) : (selectedTask.calculated_progress || 0)} 
                    className="h-2" 
                   />
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
