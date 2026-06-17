
"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Loader2,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  MessageSquare,
  Paperclip,
  Download,
  Trash2,
  FileIcon,
  X
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";

export default function TasksPage() {
  const { activeWorkspace, userProfile } = useWorkspace();
  const [tasks, setTasks] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  const forceUnlockUI = useCallback(() => {
    if (typeof document !== 'undefined') {
      setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 0);
    }
  }, []);

  useEffect(() => {
    forceUnlockUI();
    return () => forceUnlockUI();
  }, [forceUnlockUI]);

  const fetchTasks = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('my_tasks_view')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setTasks(data || []);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, supabase, toast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const fetchTaskDetails = async (taskId: string) => {
    try {
      const [
        { data: st }, 
        { data: c }, 
        { data: al }, 
        { data: att }
      ] = await Promise.all([
        supabase.from('subtasks').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
        supabase.from('task_comments').select('*, profiles(full_name)').eq('task_id', taskId).order('created_at', { ascending: true }),
        supabase.from('task_activity_logs').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
        supabase.from('attachments').select('*').eq('task_id', taskId).order('created_at', { ascending: false })
      ]);

      setSubtasks(st || []);
      setComments(c || []);
      setActivityLogs(al || []);
      setAttachments(att || []);
    } catch (err: any) {
      console.error("Error fetching task details:", err);
    }
  };

  const handleOpenDetail = (task: any) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
    fetchTaskDetails(task.id);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTask || !activeWorkspace || !userProfile) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Maximum file size is 5MB." });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${activeWorkspace.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('workspace-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('attachments').insert({
        workspace_id: activeWorkspace.id,
        task_id: selectedTask.id,
        uploaded_by: userProfile.id,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size_bytes: file.size
      });

      if (dbError) throw dbError;

      toast({ title: "Upload successful", description: `${file.name} has been attached.` });
      fetchTaskDetails(selectedTask.id);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDownloadAttachment = async (attachment: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('workspace-attachments')
        .createSignedUrl(attachment.file_path, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Download failed", description: err.message });
    }
  };

  const handleDeleteAttachment = async (attachment: any) => {
    try {
      const { error: storageError } = await supabase.storage
        .from('workspace-attachments')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from('attachments').delete().eq('id', attachment.id);
      if (dbError) throw dbError;

      toast({ title: "File deleted" });
      fetchTaskDetails(selectedTask.id);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Delete failed", description: err.message });
    }
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const priority = (formData.get("priority") as string || "medium").toLowerCase();
    const dueDate = formData.get("due_date") as string;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from('tasks').insert({
        workspace_id: activeWorkspace?.id,
        title,
        description,
        priority: priority,
        status: 'to_do',
        due_date: dueDate && dueDate.trim() !== "" ? dueDate : null,
        created_by: user.id,
        assigned_to: user.id,
        progress_mode: 'auto',
        manual_progress: 0
      });

      if (error) throw error;

      toast({ title: "Success", description: "Task created successfully" });
      setIsCreateOpen(false);
      forceUnlockUI();
      fetchTasks();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
      forceUnlockUI();
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !selectedTask) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from('subtasks').insert({
        task_id: selectedTask.id,
        title: newSubtaskTitle,
        created_by: user.id,
        is_completed: false
      });

      if (error) throw error;

      toast({ title: "Success", description: "Subtask added." });
      setNewSubtaskTitle("");
      fetchTaskDetails(selectedTask.id);
      fetchTasks();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSubtask = async (subtask: any) => {
    try {
      const { error } = await supabase.from('subtasks').update({
        is_completed: !subtask.is_completed
      }).eq('id', subtask.id);
      if (error) throw error;
      fetchTaskDetails(selectedTask.id);
      fetchTasks();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleDeleteSubtask = async (id: string) => {
    try {
      const { error } = await supabase.from('subtasks').delete().eq('id', id);
      if (error) throw error;
      fetchTaskDetails(selectedTask.id);
      fetchTasks();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTask) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from('task_comments').insert({
        task_id: selectedTask.id,
        user_id: user.id,
        comment: newComment
      });
      if (error) throw error;
      setNewComment("");
      fetchTaskDetails(selectedTask.id);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateManualProgress = async (val: number[]) => {
    if (!selectedTask) return;
    try {
      const { error } = await supabase.from('tasks').update({
        manual_progress: val[0],
        progress_mode: 'manual'
      }).eq('id', selectedTask.id);
      
      if (error) throw error;
      setSelectedTask({...selectedTask, manual_progress: val[0], progress_mode: 'manual'});
      fetchTasks();
    } catch (err: any) {
      console.error(err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">Manage and track your project assignments</p>
        </div>
        <Button 
          className="flex items-center gap-2 py-6 px-6 shadow-lg shadow-primary/20"
          onClick={() => setIsCreateOpen(true)}
        >
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
        {loading && !saving ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filteredTasks.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">No tasks found in this workspace.</p>
        ) : (
          filteredTasks.map((task) => (
            <Card 
              key={task.id} 
              className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden cursor-pointer"
              onClick={() => handleOpenDetail(task)}
            >
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  <div className={cn(
                    "w-full md:w-1.5 h-1.5 md:h-auto",
                    task.priority?.toLowerCase() === 'urgent' ? "bg-rose-500" : 
                    task.priority?.toLowerCase() === 'high' ? "bg-amber-500" : "bg-primary"
                  )} />
                  <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg group-hover:text-primary transition-colors uppercase first-letter:capitalize">{task.title}</h3>
                        <Badge variant="outline" className="text-[10px] rounded-sm capitalize">{task.priority}</Badge>
                        {task.sub_workspace_name && (
                           <Badge variant="secondary" className="text-[10px] bg-slate-100">{task.sub_workspace_name}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{task.description || 'No description'}</p>
                    </div>

                    <div className="flex items-center gap-8 min-w-[300px]">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" /> {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 border flex items-center justify-center">
                            <span className="text-[10px] font-bold text-primary">
                              {task.assigned_to_name?.[0] || '?'}
                            </span>
                          </div>
                          <span className="text-xs text-foreground font-medium">{task.assigned_to_name || 'Unassigned'}</span>
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Progress</span>
                          <span className="text-xs font-bold text-primary">{Math.round(task.calculated_progress || task.manual_progress || 0)}%</span>
                        </div>
                        <Progress value={task.calculated_progress || task.manual_progress || 0} className="h-1.5" />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={(open) => { 
        setIsCreateOpen(open);
        if (!open) forceUnlockUI();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Add a new assignment to {activeWorkspace?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title</Label>
              <Input id="title" name="title" placeholder="What needs to be done?" required disabled={saving} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" placeholder="Add more details..." disabled={saving} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select name="priority" defaultValue="medium">
                  <SelectTrigger disabled={saving}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input id="due_date" name="due_date" type="date" disabled={saving} />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => { setIsCreateOpen(false); forceUnlockUI(); }} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={isDetailOpen} onOpenChange={(open) => { 
        setIsDetailOpen(open);
        if (!open) forceUnlockUI();
      }}>
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
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl">
                   <div className="flex items-center justify-between mb-2">
                     <Label className="text-sm font-bold">Progress Tracking</Label>
                     <Badge variant={selectedTask.progress_mode === 'auto' ? 'default' : 'secondary'}>
                       {selectedTask.progress_mode === 'auto' ? 'Auto (Subtasks)' : 'Manual'}
                     </Badge>
                   </div>
                   {selectedTask.progress_mode === 'manual' ? (
                     <div className="space-y-4">
                       <Slider 
                         value={[selectedTask.manual_progress || 0]} 
                         onValueChange={handleUpdateManualProgress} 
                         max={100} 
                         step={1} 
                         disabled={saving}
                       />
                       <p className="text-xs text-center font-bold text-primary">{selectedTask.manual_progress}% Complete</p>
                     </div>
                   ) : (
                     <div className="space-y-2">
                       <Progress value={selectedTask.calculated_progress || 0} className="h-2" />
                       <p className="text-xs text-center font-bold text-primary">{Math.round(selectedTask.calculated_progress || 0)}% Complete</p>
                     </div>
                   )}
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" /> Subtasks
                  </h4>
                  <div className="space-y-2">
                    {subtasks.map((st) => (
                      <div key={st.id} className="flex items-center justify-between group p-2 hover:bg-slate-50 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={st.is_completed} 
                            onChange={() => handleToggleSubtask(st)}
                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                            disabled={saving}
                          />
                          <span className={cn("text-sm", st.is_completed && "line-through text-muted-foreground")}>{st.title}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 text-rose-500"
                          onClick={() => handleDeleteSubtask(st.id)}
                          disabled={saving}
                        >
                          <Plus className="w-4 h-4 rotate-45" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-2">
                      <Input 
                        placeholder="Add subtask..." 
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                        className="h-9 text-sm"
                        disabled={saving}
                      />
                      <Button size="sm" variant="secondary" onClick={handleAddSubtask} disabled={saving}>Add</Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-primary" /> Attachments
                    </h4>
                    <Label htmlFor="file-upload" className="cursor-pointer">
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors bg-primary/10 text-primary hover:bg-primary/20",
                        isUploading && "opacity-50 pointer-events-none"
                      )}>
                        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Upload File
                      </div>
                      <input 
                        id="file-upload" 
                        type="file" 
                        className="hidden" 
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                    </Label>
                  </div>
                  <div className="space-y-2">
                    {attachments.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No files attached yet.</p>
                    ) : (
                      attachments.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-white border rounded-lg group hover:border-primary/50 transition-colors">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center shrink-0">
                              <FileIcon className="w-4 h-4 text-slate-500" />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold truncate">{file.file_name}</p>
                              <p className="text-[10px] text-muted-foreground">{formatFileSize(file.file_size_bytes)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-primary"
                              onClick={() => handleDownloadAttachment(file)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-rose-500"
                              onClick={() => handleDeleteAttachment(file)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" /> Comments
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                      {comments.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No comments yet.</p>
                      ) : (
                        comments.map((c) => (
                          <div key={c.id} className="bg-slate-50 p-3 rounded-lg space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold">{(c.profiles as any)?.full_name || 'User'}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-sm">{c.comment}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2 pt-2 border-t mt-4">
                      <Input 
                        placeholder="Add a comment..." 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                        disabled={saving}
                      />
                      <Button onClick={handleAddComment} disabled={saving}>Post</Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-widest">Recent Activity</h4>
                  <div className="space-y-3">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="text-xs flex gap-2">
                        <Clock className="w-3 h-3 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground">{log.action}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{new Date(log.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
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
