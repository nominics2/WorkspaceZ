
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Calendar as CalendarIcon, 
  User, 
  Layout, 
  Filter, 
  FilterX, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { 
  format, 
  startOfWeek, 
  addDays, 
  isSameDay, 
  isToday, 
  startOfMonth, 
  endOfMonth, 
  startOfDay,
  parseISO
} from "date-fns";

export default function CalendarPage() {
  const { activeWorkspace } = useWorkspace();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
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
      document.body.style.overflow = "";
    }
  };

  useEffect(() => {
    return () => forceUnlockUI();
  }, []);

  const fetchData = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      // We query my_tasks_view and explicitly filter for active tasks with due dates
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

      const { data: mData, error: mErr } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', activeWorkspace.id)
        .eq('status', 'active');
      
      if (mErr) throw mErr;

      let enrichedMembers = [];
      if (mData && mData.length > 0) {
        const uids = mData.map(m => m.user_id);
        const { data: pData, error: pErr } = await supabase.from('profiles').select('id, full_name').in('id', uids);
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

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  }, [currentDate]);

  const resetFilters = () => setFilters({ teamId: "all", assignedTo: "all", status: [], priority: [] });

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'bg-rose-500';
      case 'high': return 'bg-amber-500';
      case 'medium': return 'bg-blue-500';
      default: return 'bg-slate-400';
    }
  };

  const getPriorityBg = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20';
      case 'high': return 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20';
      case 'medium': return 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20';
      default: return 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Team Calendar</h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Deadlines and project timelines for the current period
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border dark:border-slate-800">
           <Select value={filters.teamId} onValueChange={v => setFilters(f => ({...f, teamId: v}))}>
             <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs h-9">
               <Layout className="w-3.5 h-3.5 mr-2 text-primary" />
               <SelectValue placeholder="Team" />
             </SelectTrigger>
             <SelectContent className="dark:bg-slate-950">
               <SelectItem value="all">All Teams</SelectItem>
               <SelectItem value="none">No Team</SelectItem>
               {subWorkspaces.map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
             </SelectContent>
           </Select>

           <Select value={filters.assignedTo} onValueChange={v => setFilters(f => ({...f, assignedTo: v}))}>
             <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs h-9">
               <User className="w-3.5 h-3.5 mr-2 text-primary" />
               <SelectValue placeholder="Assignee" />
             </SelectTrigger>
             <SelectContent className="dark:bg-slate-950">
               <SelectItem value="all">Everyone</SelectItem>
               {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{(m.profiles as any)?.full_name}</SelectItem>)}
             </SelectContent>
           </Select>

           <DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}>
             <DropdownMenuTrigger asChild>
               <Button variant="outline" size="sm" className="h-9 text-xs gap-2 border-none bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700">
                 <Filter className="w-3.5 h-3.5" /> Filters
               </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent align="end" className="w-56 dark:bg-slate-950">
               <DropdownMenuLabel>Status</DropdownMenuLabel>
               {['to_do', 'in_progress', 'completed'].map(s => (
                 <DropdownMenuCheckboxItem 
                   key={s} 
                   checked={filters.status.includes(s)} 
                   onCheckedChange={c => setFilters(f => ({...f, status: c ? [...f.status, s] : f.status.filter(x => x !== s)}))}
                   className="capitalize"
                 >
                   {s.replace('_', ' ')}
                 </DropdownMenuCheckboxItem>
               ))}
               <DropdownMenuSeparator />
               <DropdownMenuLabel>Priority</DropdownMenuLabel>
               {['low', 'medium', 'high', 'urgent'].map(p => (
                 <DropdownMenuCheckboxItem 
                   key={p} 
                   checked={filters.priority.includes(p)} 
                   onCheckedChange={c => setFilters(f => ({...f, priority: c ? [...f.priority, p] : f.priority.filter(x => x !== p)}))}
                   className="capitalize"
                 >
                   {p}
                 </DropdownMenuCheckboxItem>
               ))}
               <DropdownMenuSeparator />
               <DropdownMenuItem onClick={resetFilters} className="text-rose-500 gap-2 font-bold">
                 <FilterX className="w-3.5 h-3.5" /> Reset All
               </DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Main Schedule Board */}
        <div className="xl:col-span-3 space-y-6">
          <Card className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden">
            <CardHeader className="p-6 border-b dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {format(currentDate, "MMMM yyyy")}
                  </h2>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentDate(prev => addDays(prev, -7))}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest px-3" onClick={() => setCurrentDate(new Date())}>
                      Today
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentDate(prev => addDays(prev, 7))}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-bold">
                  Weekly Schedule
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto no-scrollbar">
              <div className="grid grid-cols-7 min-w-[1000px] border-collapse">
                {weekDays.map((day) => {
                  const dayTasks = filteredTasks.filter(t => isSameDay(parseISO(t.due_date), day));
                  const isDayToday = isToday(day);
                  const isDaySelected = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <div 
                      key={day.toISOString()} 
                      className={cn(
                        "min-h-[600px] border-r dark:border-slate-800 last:border-r-0 transition-colors",
                        isDayToday ? "bg-primary/[0.02]" : "",
                        isDaySelected ? "bg-primary/[0.04]" : ""
                      )}
                      onClick={() => setSelectedDate(day)}
                    >
                      <div className={cn(
                        "p-4 sticky top-[73px] z-[5] text-center border-b dark:border-slate-800 transition-all",
                        isDayToday ? "bg-primary text-white" : "bg-slate-50/80 dark:bg-slate-950/40 backdrop-blur-sm"
                      )}>
                        <p className={cn(
                          "text-[10px] font-bold uppercase tracking-[0.2em] mb-1",
                          isDayToday ? "text-white/80" : "text-slate-400"
                        )}>
                          {format(day, "EEE")}
                        </p>
                        <p className="text-xl font-extrabold">{format(day, "d")}</p>
                      </div>

                      <div className="p-3 space-y-3">
                        {loading ? (
                          <div className="flex justify-center py-10 opacity-20">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        ) : dayTasks.length === 0 ? (
                          <div className="py-20 flex flex-col items-center justify-center opacity-10">
                            <Clock className="w-8 h-8" />
                          </div>
                        ) : (
                          dayTasks.map(task => (
                            <Card 
                              key={task.id} 
                              className={cn(
                                "group cursor-pointer hover:shadow-lg transition-all border-l-4 hover:translate-y-[-2px] active:scale-95 overflow-hidden",
                                getPriorityBg(task.priority),
                                task.status === 'completed' && "opacity-60"
                              )}
                              style={{ borderLeftColor: `hsl(var(--primary))` }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTask(task);
                                setIsDetailOpen(true);
                              }}
                            >
                              <CardContent className="p-3 space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                  <h4 className={cn(
                                    "text-xs font-bold leading-tight line-clamp-2",
                                    task.status === 'completed' && "line-through text-muted-foreground"
                                  )}>
                                    {task.title}
                                  </h4>
                                  <Badge className={cn("text-[8px] h-4 py-0 uppercase shrink-0", getPriorityColor(task.priority))}>
                                    {task.priority[0]}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                  <div className="flex -space-x-1">
                                    <Badge variant="outline" className="text-[8px] h-4 border-none bg-black/5 dark:bg-white/5 font-medium">
                                      {format(parseISO(task.due_date), "HH:mm")}
                                    </Badge>
                                  </div>
                                  <span className="text-[9px] font-bold text-slate-400 truncate max-w-[60px]">
                                    {task.assigned_to_name?.split(' ')[0] || 'Unassigned'}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Controls */}
        <div className="space-y-6">
          <Card className="border-none shadow-md bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden">
            <CardContent className="p-4">
              <Calendar 
                mode="single" 
                selected={selectedDate} 
                onSelect={setSelectedDate} 
                className="w-full"
                classNames={{
                  months: "w-full",
                  month: "w-full space-y-4",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex justify-around",
                  row: "flex w-full mt-2 justify-around",
                  day: "h-10 w-10 p-0 font-medium rounded-xl hover:bg-primary/10 transition-all flex items-center justify-center dark:text-slate-300",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_today: "bg-accent text-accent-foreground font-bold",
                }}
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 px-2">
              <Clock className="w-4 h-4" />
              {selectedDate ? format(selectedDate, "MMM d, yyyy") : 'Deadlines'}
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filteredTasks.filter(t => selectedDate && isSameDay(parseISO(t.due_date), selectedDate)).length === 0 ? (
                <div className="text-center py-10 bg-slate-50/50 dark:bg-slate-900/40 rounded-3xl border-2 border-dashed dark:border-slate-800">
                  <p className="text-xs font-medium text-slate-400">No tasks due today.</p>
                </div>
              ) : (
                filteredTasks
                  .filter(t => selectedDate && isSameDay(parseISO(t.due_date), selectedDate))
                  .map(task => (
                    <Card 
                      key={task.id} 
                      className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer group bg-white dark:bg-slate-900 rounded-2xl overflow-hidden"
                      onClick={() => {
                        setSelectedTask(task);
                        setIsDetailOpen(true);
                      }}
                    >
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={cn("w-1 h-10 rounded-full shrink-0", getPriorityColor(task.priority))} />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate dark:text-white group-hover:text-primary transition-colors">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "text-[10px] font-bold uppercase",
                              task.is_overdue ? "text-rose-500" : "text-slate-400"
                            )}>
                              {task.is_overdue ? "Overdue" : task.status.replace('_', ' ')}
                            </span>
                            {task.sub_workspace_name && (
                              <Badge variant="secondary" className="text-[8px] h-3.5 px-1 bg-violet-500/10 text-violet-500 border-none">
                                {task.sub_workspace_name}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))
              )}
            </div>
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
                      {format(parseISO(selectedTask.due_date), "PPP p")}
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

                <div className="pt-6 flex justify-end">
                  <Button variant="outline" className="rounded-xl" onClick={() => setIsDetailOpen(false)}>Close Panel</Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
