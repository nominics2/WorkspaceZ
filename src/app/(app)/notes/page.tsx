"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Search, StickyNote, MoreVertical, Link as LinkIcon, Loader2, Globe, Lock, Layout, FilterX, ShieldCheck, User, LayoutDashboard, Trash2 } from "lucide-react";
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
  DialogDescription,
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

export default function NotesPage() {
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
    sub_workspace_id: "none"
  });

  // Filters
  const [filters, setFilters] = useState({
    visibility: "all",
    teamId: "all",
    isLinked: "all"
  });

  const supabase = createClient();
  const { toast } = useToast();

  const forceUnlockUI = useCallback(() => {
    if (typeof document !== 'undefined') {
      setTimeout(() => {
        document.body.style.pointerEvents = "";
      }, 100);
    }
  }, []);

  useEffect(() => {
    forceUnlockUI();
    return () => forceUnlockUI();
  }, [forceUnlockUI]);

  const fetchData = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const [notesRes, teamsRes] = await Promise.all([
        supabase
          .from('notes')
          .select('*, sub_workspaces(name)')
          .eq('workspace_id', activeWorkspace.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('sub_workspaces')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .order('name', { ascending: true })
      ]);

      if (notesRes.error) throw notesRes.error;
      if (teamsRes.error) throw teamsRes.error;

      setNotes(notesRes.data || []);
      setSubWorkspaces(teamsRes.data || []);

      const noteId = searchParams.get('noteId');
      if (noteId) {
        const note = notesRes.data?.find(n => n.id === noteId);
        if (note) handleOpenEdit(note);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
      forceUnlockUI();
    }
  }, [activeWorkspace, supabase, toast, forceUnlockUI, searchParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !userProfile) return;
    setSaving(true);
    const subWsId = form.sub_workspace_id === "none" ? null : form.sub_workspace_id;
    try {
      if (editingNote) {
        await supabase.from('notes').update({ title: form.title, content: form.content, visibility: form.visibility, sub_workspace_id: subWsId, updated_at: new Date().toISOString() }).eq('id', editingNote.id);
        toast({ title: "Note Updated" });
      } else {
        await supabase.from('notes').insert({ workspace_id: activeWorkspace.id, created_by: userProfile.id, title: form.title, content: form.content, visibility: form.visibility, sub_workspace_id: subWsId });
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
    setSaving(true);
    try {
      const { error } = await supabase.rpc('move_note_to_trash', {
        p_note_id: note.id
      });
      if (error) throw error;
      toast({ title: "Note moved to trash" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (note: any) => {
    setEditingNote(note);
    setForm({ title: note.title, content: note.content, visibility: note.visibility, sub_workspace_id: note.sub_workspace_id || "none" });
    setIsModalOpen(true);
  };

  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) || n.content.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (filters.visibility !== "all" && n.visibility !== filters.visibility) return false;
      if (filters.teamId !== "all") {
        if (filters.teamId === "none" && n.sub_workspace_id) return false;
        if (filters.teamId !== "none" && n.sub_workspace_id !== filters.teamId) return false;
      }
      if (filters.isLinked === "yes" && !n.task_id) return false;
      if (filters.isLinked === "no" && n.task_id) return false;

      return true;
    });
  }, [notes, searchTerm, filters]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notes</h1>
          <p className="text-muted-foreground">Keep your thoughts and project details organized</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => { setForm({ title: "", content: "", visibility: "personal", sub_workspace_id: "none" }); setIsModalOpen(true); }} className="flex items-center gap-2">
            <Lock className="w-4 h-4" /> New Personal Note
          </Button>
          <Button onClick={() => { setForm({ title: "", content: "", visibility: "workspace", sub_workspace_id: "none" }); setIsModalOpen(true); }} className="flex items-center gap-2 shadow-lg shadow-primary/20">
            <Plus className="w-5 h-5" /> New Workspace Note
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-2 rounded-xl shadow-sm border">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              className="pl-10 border-none shadow-none focus-visible:ring-0" 
              placeholder="Search notes..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap px-2">
             <Select value={filters.visibility} onValueChange={v => setFilters(f => ({...f, visibility: v}))}>
               <SelectTrigger className="w-[130px] h-8 border-none bg-slate-50 text-xs rounded-lg">
                 <ShieldCheck className="w-3 h-3 mr-2" />
                 <SelectValue placeholder="Visibility" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Visibility</SelectItem>
                 <SelectItem value="personal">Personal Only</SelectItem>
                 <SelectItem value="workspace">Workspace Shared</SelectItem>
               </SelectContent>
             </Select>

             <Select value={filters.teamId} onValueChange={v => setFilters(f => ({...f, teamId: v}))}>
               <SelectTrigger className="w-[130px] h-8 border-none bg-slate-50 text-xs rounded-lg">
                 <Layout className="w-3 h-3 mr-2" />
                 <SelectValue placeholder="Team" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Teams</SelectItem>
                 <SelectItem value="none">No Team</SelectItem>
                 {subWorkspaces.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
               </SelectContent>
             </Select>

             <Select value={filters.isLinked} onValueChange={v => setFilters(f => ({...f, isLinked: v}))}>
               <SelectTrigger className="w-[130px] h-8 border-none bg-slate-50 text-xs rounded-lg">
                 <LinkIcon className="w-3 h-3 mr-2" />
                 <SelectValue placeholder="Linked" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Linked (All)</SelectItem>
                 <SelectItem value="yes">Task Linked</SelectItem>
                 <SelectItem value="no">Not Linked</SelectItem>
               </SelectContent>
             </Select>

             {(filters.visibility !== 'all' || filters.teamId !== 'all' || filters.isLinked !== 'all') && (
               <Button variant="ghost" size="sm" onClick={() => setFilters({visibility: 'all', teamId: 'all', isLinked: 'all'})} className="h-8 px-2 text-rose-500 hover:text-rose-600">
                 <FilterX className="w-4 h-4" />
               </Button>
             )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
           <Badge variant={filters.visibility === 'personal' ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => setFilters(f => ({...f, visibility: f.visibility === 'personal' ? 'all' : 'personal'}))}>
             <User className="w-3 h-3 mr-1" /> My Personal Notes
           </Badge>
           <Badge variant={filters.visibility === 'workspace' ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => setFilters(f => ({...f, visibility: f.visibility === 'workspace' ? 'all' : 'workspace'}))}>
             <LayoutDashboard className="w-3 h-3 mr-1" /> Workspace Knowledge
           </Badge>
        </div>
      </div>

      {loading && !saving ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed flex flex-col items-center gap-4">
          <StickyNote className="w-12 h-12 text-slate-300" />
          <div>
            <p className="font-bold text-lg">No notes found</p>
            <p className="text-muted-foreground text-sm">Adjust filters or create your first note.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="border-none shadow-sm hover:shadow-md transition-all group relative h-full flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="p-2 bg-primary/5 rounded-lg">
                  <StickyNote className="w-5 h-5 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={note.visibility === 'workspace' ? 'default' : 'secondary'} className="text-[10px] uppercase gap-1">
                    {note.visibility === 'workspace' ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                    {note.visibility}
                  </Badge>
                  <DropdownMenu onOpenChange={(open) => { if (!open) forceUnlockUI(); }}>
                    <DropdownMenuTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEdit(note)}>Edit Note</DropdownMenuItem>
                      <DropdownMenuItem className="text-rose-500" onClick={() => handleMoveToTrash(note)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Move to Trash
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="cursor-pointer flex-1" onClick={() => handleOpenEdit(note)}>
                <h3 className="font-bold text-lg mb-2 line-clamp-1">{note.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-4 min-h-[5rem] whitespace-pre-wrap">
                  {note.content}
                </p>
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-2 pt-0 border-t mt-auto pt-4">
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {new Date(note.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    {note.sub_workspaces?.name && (
                      <Badge variant="secondary" className="text-[9px] bg-violet-50 text-violet-600 border-none h-4">
                        {note.sub_workspaces.name}
                      </Badge>
                    )}
                    {note.task_id && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-primary">
                        <LinkIcon className="w-3 h-3" /> Linked
                      </div>
                    )}
                  </div>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        if (!open) { setEditingNote(null); forceUnlockUI(); }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit Note' : 'Create New Note'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Note title..." required disabled={saving} />
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={form.visibility} onValueChange={(v: any) => setForm({...form, visibility: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal (Private)</SelectItem>
                  <SelectItem value="workspace">Workspace (Shared)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} placeholder="Write something..." rows={8} required disabled={saving} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save Note</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
