"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { 
  Plus, 
  Search, 
  StickyNote, 
  MoreVertical, 
  Link as LinkIcon, 
  Loader2, 
  Globe, 
  Lock, 
  Layout, 
  FilterX, 
  ShieldCheck, 
  User, 
  LayoutDashboard, 
  Trash2,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

const NOTE_COLORS = [
  { id: 'default', label: 'Default', bg: 'bg-slate-200 dark:bg-slate-700', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-500', tint: 'bg-slate-50/50 dark:bg-slate-900/50' },
  { id: 'blue', label: 'Blue', bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500', tint: 'bg-blue-50/30 dark:bg-blue-900/10' },
  { id: 'green', label: 'Green', bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-500', tint: 'bg-emerald-50/30 dark:bg-emerald-900/10' },
  { id: 'yellow', label: 'Yellow', bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-500', tint: 'bg-amber-50/30 dark:bg-amber-900/10' },
  { id: 'orange', label: 'Orange', bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500', tint: 'bg-orange-50/30 dark:bg-orange-900/10' },
  { id: 'red', label: 'Red', bg: 'bg-rose-500', border: 'border-rose-500', text: 'text-rose-500', tint: 'bg-rose-50/30 dark:bg-rose-900/10' },
  { id: 'pink', label: 'Pink', bg: 'bg-pink-500', border: 'border-pink-500', text: 'text-pink-500', tint: 'bg-pink-50/30 dark:bg-pink-900/10' },
  { id: 'purple', label: 'Purple', bg: 'bg-violet-500', border: 'border-violet-500', text: 'text-violet-500', tint: 'bg-violet-50/30 dark:bg-violet-900/10' },
  { id: 'gray', label: 'Gray', bg: 'bg-slate-500', border: 'border-slate-500', text: 'text-slate-500', tint: 'bg-slate-50/30 dark:bg-slate-900/10' },
];

function NotesPageContent() {
  const { activeWorkspace, userProfile } = useWorkspace();
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState<any[]>([]);
  const [subWorkspaces, setSubWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [form, setForm] = useState({ 
    title: "", 
    content: "", 
    visibility: "workspace" as "personal" | "workspace", 
    sub_workspace_id: "none",
    color: "default"
  });

  const [filters, setFilters] = useState({ visibility: "all", teamId: "all", isLinked: "all" });

  const supabase = createClient();
  const { toast } = useToast();

  const forceUnlockUI = useCallback(() => {
    if (typeof document !== 'undefined') {
      // Immediate reset to override any active locks
      document.body.style.pointerEvents = "auto";
      document.body.style.overflow = "auto";
      
      // Secondary cleanup after delay to catch Radix exit transitions
      setTimeout(() => {
        document.body.style.pointerEvents = "";
        document.body.style.overflow = "";
      }, 300);
    }
  }, []);

  useEffect(() => {
    return () => forceUnlockUI();
  }, [forceUnlockUI]);

  // Ensure UI is unlocked whenever modal closes
  useEffect(() => {
    if (!isModalOpen) {
      forceUnlockUI();
    }
  }, [isModalOpen, forceUnlockUI]);

  const fetchData = useCallback(async () => {
    if (!activeWorkspace || !userProfile) return;
    setLoading(true);
    try {
      const [notesRes, teamsRes] = await Promise.all([
        supabase.from('notes').select('*, sub_workspaces(name)').eq('workspace_id', activeWorkspace.id).eq('is_deleted', false).or(`visibility.eq.workspace,created_by.eq.${userProfile.id}`).order('created_at', { ascending: false }),
        supabase.from('sub_workspaces').select('*').eq('workspace_id', activeWorkspace.id).order('name', { ascending: true })
      ]);
      if (notesRes.error) throw notesRes.error;
      if (teamsRes.error) throw teamsRes.error;
      setNotes(notesRes.data || []); setSubWorkspaces(teamsRes.data || []);
      const noteId = searchParams.get('noteId');
      if (noteId) {
        const note = notesRes.data?.find(n => n.id === noteId);
        if (note) handleOpenEdit(note);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally { setLoading(false); }
  }, [activeWorkspace, userProfile, supabase, toast, searchParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !userProfile) return;
    setSaving(true);
    const subWsId = form.sub_workspace_id === "none" ? null : form.sub_workspace_id;
    try {
      if (editingNote) {
        await supabase.from('notes').update({ 
          title: form.title, 
          content: form.content, 
          visibility: form.visibility, 
          sub_workspace_id: subWsId,
          color: form.color,
          updated_at: new Date().toISOString() 
        }).eq('id', editingNote.id);
        toast({ title: "Note Updated" });
      } else {
        await supabase.from('notes').insert({ 
          workspace_id: activeWorkspace.id, 
          created_by: userProfile.id, 
          title: form.title, 
          content: form.content, 
          visibility: form.visibility, 
          sub_workspace_id: subWsId,
          color: form.color
        });
        toast({ title: "Note Created" });
      }
      setIsModalOpen(false);
      await fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally { 
      setSaving(false); 
      forceUnlockUI(); 
    }
  };

  const handleMoveToTrash = async (note: any) => {
    if (note.created_by !== userProfile?.id && note.visibility === 'personal') {
      toast({ variant: "destructive", title: "Permission Denied", description: "You can only delete your own notes." });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('move_note_to_trash', { p_note_id: note.id });
      if (error) throw error;
      toast({ title: "Note moved to trash" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally { 
      setSaving(false); 
      forceUnlockUI(); 
    }
  };

  const handleOpenEdit = (note: any) => {
    setEditingNote(note);
    setForm({ 
      title: note.title, 
      content: note.content, 
      visibility: note.visibility, 
      sub_workspace_id: note.sub_workspace_id || "none",
      color: note.color || "default"
    });
    setIsModalOpen(true);
  };

  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) || n.content.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (filters.visibility !== "all" && n.visibility !== filters.visibility) return false;
      if (filters.teamId !== "all") { if (filters.teamId === "none" && n.sub_workspace_id) return false; if (filters.teamId !== "none" && n.sub_workspace_id !== filters.teamId) return false; }
      if (filters.isLinked === "yes" && !n.task_id) return false;
      if (filters.isLinked === "no" && n.task_id) return false;
      return true;
    });
  }, [notes, searchTerm, filters]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Notes & Knowledge</h1>
          <p className="text-muted-foreground font-medium">Capture project insights and team documentation</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setForm({ title: "", content: "", visibility: "personal", sub_workspace_id: "none", color: "default" }); setEditingNote(null); setIsModalOpen(true); }} className="h-11 rounded-xl px-5 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:bg-slate-50">
            <Lock className="w-4 h-4 mr-2 text-slate-400" /> Private Note
          </Button>
          <Button onClick={() => { setForm({ title: "", content: "", visibility: "workspace", sub_workspace_id: "none", color: "default" }); setEditingNote(null); setIsModalOpen(true); }} className="h-11 rounded-xl px-5 shadow-lg shadow-primary/20">
            <Plus className="w-5 h-5 mr-2" /> Shared Note
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-[1.5rem] shadow-sm border dark:border-slate-800">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input className="pl-11 h-11 border-none shadow-none focus-visible:ring-0 dark:bg-slate-900 dark:text-slate-100 text-base" placeholder="Search the knowledge base..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap px-2 no-scrollbar">
             <Select value={filters.visibility} onValueChange={v => setFilters(f => ({...f, visibility: v}))}>
               <SelectTrigger className="w-[140px] h-9 border-none bg-slate-100 dark:bg-slate-800 text-xs rounded-xl font-bold uppercase tracking-wider dark:text-slate-300">
                 <ShieldCheck className="w-3.5 h-3.5 mr-2 text-primary" />
                 <SelectValue placeholder="Visibility" />
               </SelectTrigger>
               <SelectContent className="dark:bg-slate-900">
                 <SelectItem value="all">All Access</SelectItem>
                 <SelectItem value="personal">Personal</SelectItem>
                 <SelectItem value="workspace">Workspace</SelectItem>
               </SelectContent>
             </Select>

             <Select value={filters.teamId} onValueChange={v => setFilters(f => ({...f, teamId: v}))}>
               <SelectTrigger className="w-[140px] h-9 border-none bg-slate-100 dark:bg-slate-800 text-xs rounded-xl font-bold uppercase tracking-wider dark:text-slate-300">
                 <Layout className="w-3.5 h-3.5 mr-2 text-violet-500" />
                 <SelectValue placeholder="Team" />
               </SelectTrigger>
               <SelectContent className="dark:bg-slate-900">
                 <SelectItem value="all">All Teams</SelectItem>
                 <SelectItem value="none">General</SelectItem>
                 {subWorkspaces.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
               </SelectContent>
             </Select>

             {filters.visibility !== 'all' || filters.teamId !== 'all' || filters.isLinked !== 'all' ? (
               <Button variant="ghost" size="sm" onClick={() => setFilters({visibility: 'all', teamId: 'all', isLinked: 'all'})} className="h-9 px-3 text-rose-500 hover:bg-rose-50 rounded-xl">
                 <FilterX className="w-4 h-4" />
               </Button>
             ) : null}
          </div>
        </div>
      </div>

      {loading && !saving ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-32 bg-white dark:bg-slate-900/40 rounded-[2.5rem] border-2 border-dashed dark:border-slate-800 flex flex-col items-center gap-4 opacity-70">
          <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-full mb-2">
            <StickyNote className="w-12 h-12 text-slate-300 dark:text-slate-700" />
          </div>
          <div>
            <p className="font-extrabold text-xl text-slate-900 dark:text-slate-100">Your Knowledge Base is Empty</p>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-1">Start capturing ideas, instructions, or meeting summaries here.</p>
          </div>
          <Button variant="outline" className="mt-4 rounded-xl border-slate-200 dark:border-slate-800" onClick={() => setIsModalOpen(true)}>Create First Note</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note) => {
            const colorConfig = NOTE_COLORS.find(c => c.id === (note.color || 'default')) || NOTE_COLORS[0];
            return (
              <Card key={note.id} className={cn("border-none shadow-md hover:shadow-xl transition-all group relative h-full flex flex-col overflow-hidden dark:bg-slate-900 rounded-[2rem]", colorConfig.tint)}>
                <div className={cn("h-1.5 w-full", colorConfig.bg)} />
                <CardHeader className="flex flex-row items-center justify-between pb-3 pt-6 px-6">
                  <div className={cn("p-2 rounded-xl shadow-sm", colorConfig.bg.replace('bg-', 'bg-opacity-20 bg-'))}>
                    <StickyNote className={cn("w-4 h-4 text-white")} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[9px] uppercase font-extrabold tracking-[0.1em] gap-1.5 h-5 bg-white dark:bg-slate-800 border-none shadow-sm dark:text-slate-300">
                      {note.visibility === 'workspace' ? <Globe className="w-2.5 h-2.5 text-emerald-500" /> : <Lock className="w-2.5 h-2.5 text-amber-500" />}
                      {note.visibility}
                    </Badge>
                    <DropdownMenu onOpenChange={(open) => !open && forceUnlockUI()}>
                      <DropdownMenuTrigger asChild>
                        <button className="text-slate-300 hover:text-primary transition-colors p-1 focus:outline-none"><MoreVertical className="w-4 h-4" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="dark:bg-slate-900 dark:border-slate-800 rounded-xl">
                        <DropdownMenuItem onClick={() => handleOpenEdit(note)} className="gap-2 focus:bg-slate-100 dark:focus:bg-slate-800"><Layout className="w-4 h-4" /> Edit Details</DropdownMenuItem>
                        <DropdownMenuItem className="text-rose-500 dark:hover:bg-rose-500/10 gap-2 focus:bg-rose-50 dark:focus:bg-rose-500/10" onClick={() => handleMoveToTrash(note)}><Trash2 className="w-4 h-4" /> Remove to Trash</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="cursor-pointer flex-1 px-6 pb-6" onClick={() => handleOpenEdit(note)}>
                  <h3 className="font-extrabold text-xl mb-3 line-clamp-2 text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">{note.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-6 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                </CardContent>
                <CardFooter className="flex flex-col items-start gap-4 border-t dark:border-slate-800 mt-auto py-5 px-6 bg-white/40 dark:bg-slate-950/20">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(note.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="w-1 h-1 bg-slate-300 rounded-full" />
                      {note.sub_workspaces?.name ? (
                        <Badge variant="secondary" className="text-[9px] bg-primary/5 text-primary border-none font-bold uppercase tracking-tighter h-4">
                          {note.sub_workspaces.name}
                        </Badge>
                      ) : <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Workspace</span>}
                    </div>
                    {note.task_id && (
                      <Badge variant="outline" className="text-[8px] h-4 font-bold border-emerald-500/20 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10">
                        <LinkIcon className="w-2.5 h-2.5 mr-1" /> LINKED
                      </Badge>
                    )}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) { setEditingNote(null); forceUnlockUI(); } }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden dark:bg-slate-950 dark:border-slate-800 rounded-[2rem] shadow-2xl border-none">
          <div className={cn("h-2 w-full", NOTE_COLORS.find(c => c.id === form.color)?.bg || 'bg-primary')} />
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{editingNote ? 'Refine Note' : 'Capture Knowledge'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 ml-1">Title</Label>
                <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Give your note a clear heading..." required disabled={saving} className="h-12 text-base font-bold dark:bg-slate-900 dark:border-slate-800 rounded-xl focus-visible:ring-primary/20 border-none bg-slate-50 dark:bg-slate-900 shadow-none" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 ml-1">Visibility</Label>
                  <Select value={form.visibility} onValueChange={(v: any) => setForm({...form, visibility: v})}>
                    <SelectTrigger className="h-11 dark:bg-slate-900 dark:border-slate-800 rounded-xl border-none shadow-none bg-slate-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                      <SelectItem value="personal" className="gap-2"><Lock className="w-3.5 h-3.5 text-amber-500" /> Private (You only)</SelectItem>
                      <SelectItem value="workspace" className="gap-2"><Globe className="w-3.5 h-3.5 text-emerald-500" /> Shared (All members)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 ml-1">Note Color</Label>
                  <div className="flex items-center gap-2 pt-1">
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setForm({...form, color: c.id})}
                        className={cn(
                          "w-7 h-7 rounded-full transition-all hover:scale-110 shadow-sm flex items-center justify-center relative",
                          c.bg,
                          form.color === c.id ? "ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-950 scale-110" : "opacity-80"
                        )}
                        title={c.label}
                      >
                        {form.color === c.id && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 ml-1">Content</Label>
                <Textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} placeholder="Detailed insights, documentation, or meeting summaries..." rows={10} required disabled={saving} className="text-base leading-relaxed dark:bg-slate-900 dark:border-slate-800 rounded-2xl resize-none focus-visible:ring-primary/20 border-none bg-slate-50 shadow-none" />
              </div>

              <DialogFooter className="gap-3 pt-6 border-t dark:border-slate-800 mt-4">
                <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); forceUnlockUI(); }} disabled={saving} className="rounded-xl h-11 px-6 font-bold text-slate-500">Cancel</Button>
                <Button type="submit" disabled={saving || !form.title.trim()} className="rounded-xl h-11 px-8 shadow-lg shadow-primary/20 font-bold min-w-[140px]">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : editingNote ? 'Update Note' : 'Create Note'}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function NotesPage() {
  return (<Suspense fallback={<div className="flex h-[50vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}><NotesPageContent /></Suspense>);
}
