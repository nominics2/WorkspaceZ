"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  AlertCircle,
  CalendarDays,
  Settings2,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuCheckboxItem, 
  DropdownMenuTrigger, 
  DropdownMenuItem 
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  format, 
  startOfWeek, 
  addDays, 
  isSameDay, 
  isToday, 
  startOfDay,
  parseISO,
  startOfMonth,
  endOfMonth,
  isWithinInterval
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

  const forceUnlockUI = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = "auto";
      document.body.style.overflow = "auto";
      setTimeout(() => {
        document.body.style.pointerEvents = "";
        document.body.style.overflow = "";
      }, 300);
    }
  }, []);

  useEffect(() => {
    return () => forceUnlockUI();
  }, [forceUnlockUI]);

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
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 max-w-[1600px] mx-auto">
      {/* Dynamic Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <CalendarIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {format(currentDate, "MMMM yyyy")}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-400 dark:border-slate-800">
                Weekly Schedule
              </Badge>
              <span className="w-1 h-1 bg-slate-300 rounded-full" />
              <p className="text-xs text-muted-foreground font-medium">
                {format(weekDays[0], "MMM d")} - {format(weekDays[6], "MMM d, yyyy")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Week Navigation */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentDate(prev => addDays(prev, -7))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <Popover onOpenChange={(open) => !open && forceUnlockUI()}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest px-3 gap-2">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Jump to
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-none shadow-2xl" align="center">
                <Calendar 
                  mode="single" 
                  selected={currentDate} 
                  onSelect={(d) => d && setCurrentDate(d)} 
                  className="rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-950"
                />
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest px-3" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentDate(prev => addDays(prev, 7))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-8 mx-2 hidden xl:block" />

          {/* Quick Filters */}
          <div className="flex items-center gap-2">
            <Select value={filters.teamId} onValueChange={v => setFilters(f => ({...f, teamId: v}))} onOpenChange={(open) => !open && forceUnlockUI()}>
              <SelectTrigger className="w-[140px] h-9 rounded-xl border dark:border-slate-800 text-xs font-bold bg-white dark:bg-slate-950 shadow-none">
                <Layout className="w-3.5 h-3.5 mr-2 text-primary" />
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-950">
                <SelectItem value="all">All Teams</SelectItem>
                <SelectItem value="none">General</SelectItem>
                {subWorkspaces.map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-xs gap-2 rounded-xl dark:border-slate-800 bg-white dark:bg-slate-950 shadow-none">
                  <Filter className="w-3.5 h-3.5" /> Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 dark:bg-slate-950 rounded-xl">
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
      </div>

      {/* Main Grid View */}
      <Card className="border-none shadow-xl bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-0 overflow-x-auto no-scrollbar">
          <div className="grid grid-cols-7 min-w-[1200px] divide-x dark:divide-slate-800">
            {weekDays.map((day) => {
              const dayTasks = filteredTasks.filter(t => isSameDay(parseISO(t.due_date), day));
              const isDayToday = isToday(day);
              const isDaySelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <div 
                  key={day.toISOString()} 
                  className={cn(
                    "min-h-[700px] transition-colors flex flex-col group/day",
                    isDayToday ? "bg-primary/[0.02]" : "bg-white dark:bg-slate-900"
                  )}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className={cn(
                    "p-6 text-center border-b dark:border-slate-800 transition-all sticky top-0 z-20 backdrop-blur-md",
                    isDayToday ? "bg-primary text-white" : "bg-slate-50/80 dark:bg-slate-950/80"
                  )}>
                    <p className={cn(
                      "text-[10px] font-bold uppercase tracking-[0.2em] mb-1",
                      isDayToday ? "text-white/80" : "text-slate-400"
                    )}>
                      {format(day, "EEEE")}
                    </p>
                    <p className="text-3xl font-extrabold">{format(day, "d")}</p>
                  </div>

                  <div className="p-4 space-y-4 flex-1">
                    {loading ? (
                      <div className="flex justify-center py-20 opacity-20">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : dayTasks.length === 0 ? (
                      <div className="py-20 flex flex-col items-center justify-center opacity-0 group-hover/day:opacity-5 transition-opacity">
                        <Clock className="w-12 h-12" />
                      </div>
                    ) : (
                      dayTasks.map(task => (
                        <Card 
                          key={task.id} 
                          className={cn(
                            "group cursor-pointer hover:shadow-xl transition-all border-l-4 hover:translate-y-[-4px] active:scale-95 overflow-hidden rounded-2xl",
                            getPriorityBg(task.priority),
                            task.status === 'completed' && "opacity-60 grayscale-[0.5]"
                          )}
                          style={{ borderLeftColor: `hsl(var(--primary))` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(task);
                            setIsDetailOpen(true);
                          }}
                        >
                          <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start gap-2">
                              <h4 className={cn(
                                "text-xs font-bold leading-tight line-clamp-3 dark:text-slate-100",
                                task.status === 'completed' && "line-through text-muted-foreground"
                              )}>
                                {task.title}
                              </h4>
                            </div>
                            
                            <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[9px] h-4 py-0 border-none bg-black/5 dark:bg-white/10 font-bold uppercase tracking-tighter">
                                  {format(parseISO(task.due_date), "HH:mm")}
                                </Badge>
                                {task.priority === 'urgent' && <AlertCircle className="w-3 h-3 text-rose-500 animate-pulse" />}
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 truncate max-w-[80px]">
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

      {/* Mobile/Floating Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={(open) => { setIsDetailOpen(open); if (!open) forceUnlockUI(); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto dark:bg-slate-950 dark:border-slate-800 p-0">
          {selectedTask && (
            <div className="flex flex-col h-full">
              <div className={cn("h-2 w-full", getPriorityColor(selectedTask.priority))} />
              <div className="p-8 space-y-8">
                <SheetHeader>
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <Badge variant="outline" className="capitalize dark:border-slate-800 dark:text-slate-400 font-bold">{selectedTask.priority}</Badge>
                    <Badge variant="secondary" className="capitalize dark:bg-slate-900 dark:text-slate-300 font-bold">{selectedTask.status?.replace('_', ' ')}</Badge>
                  </div>
                  <SheetTitle className="text-3xl font-extrabold dark:text-slate-100 tracking-tight leading-tight">
                    {selectedTask.title}
                  </SheetTitle>
                  <SheetDescription className="text-base text-slate-500 dark:text-slate-400 pt-2 leading-relaxed">
                    {selectedTask.description || 'No description provided.'}
                  </SheetDescription>
                </SheetHeader>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 space-y-1.5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Deadline</p>
                      <p className="text-sm font-bold flex items-center gap-2 dark:text-slate-100">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        {format(parseISO(selectedTask.due_date), "PPP p")}
                      </p>
                    </div>
                    <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 space-y-1.5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Owner</p>
                      <p className="text-sm font-bold flex items-center gap-2 dark:text-slate-100">
                        <User className="w-4 h-4 text-primary" />
                        {selectedTask.assigned_to_name || 'Unassigned'}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold dark:text-slate-100 flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-primary" />
                        Execution Progress
                      </span>
                      <span className="text-xs font-extrabold text-primary">
                        {Math.round(selectedTask.progress_mode === 'manual' ? (selectedTask.manual_progress || 0) : (selectedTask.calculated_progress || 0))}%
                      </span>
                    </div>
                    <Progress 
                      value={selectedTask.progress_mode === 'manual' ? (selectedTask.manual_progress || 0) : (selectedTask.calculated_progress || 0)} 
                      className="h-2 bg-slate-200 dark:bg-slate-800" 
                    />
                  </div>

                  <div className="pt-10 flex flex-col gap-3">
                    <Button 
                      className="w-full h-12 rounded-2xl font-bold shadow-lg shadow-primary/20" 
                      onClick={() => setIsDetailOpen(false)}
                    >
                      Return to Calendar
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full h-12 rounded-2xl text-slate-400 hover:text-slate-900 font-bold"
                      onClick={() => window.location.href = `/tasks?taskId=${selectedTask.id}`}
                    >
                      Open Task Details
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}