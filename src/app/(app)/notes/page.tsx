"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, StickyNote, MoreVertical, Link as LinkIcon, Loader2, Trash2, Globe, Lock, Layout } from "lucide-react";
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

export default function NotesPage() {
  const { activeWorkspace, userProfile } = useWorkspace();
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

  useEffect(() => {
    if (!isModalOpen && !saving) {
      forceUnlockUI();
    }
  }, [isModalOpen, saving, forceUnlockUI]);

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
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
      forceUnlockUI();
    }
  }, [activeWorkspace, supabase, toast, forceUnlockUI]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenCreate = (visibility: "personal" | "workspace") => {
    setEditingNote(null);
    setForm({ title: "", content: "", visibility, sub_workspace_id: "none" });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (note: any) => {
    setEditingNote(note);
    setForm({
      title: note.title,
      content: note.content,
      visibility: note.visibility,
      sub_workspace_id: note.sub_workspace_id || "none"
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !userProfile) return;

    setSaving(true);
    const subWsId = form.sub_workspace_id === "none" ? null : form.sub_workspace_id;
    
    try {
      if (editingNote) {
        const { error } = await supabase
          .from('notes')
          .update({
            title: form.title,
            content: form.content,
            visibility: form.visibility,
            sub_workspace_id: subWsId,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingNote.id);
        if (error) throw error;
        toast({ title: "Note Updated" });
      } else {
        const { error } = await supabase
          .from('notes')
          .insert({
            workspace_id: activeWorkspace.id,
            created_by: userProfile.id,
            title: form.title,
            content: form.content,
            visibility: form.visibility,
            sub_workspace_id: subWsId
          });
        if (error) throw error;
        toast({ title: "Note Created" });
      }
      
      setIsModalOpen(false);
      setEditingNote(null);
      await fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
      forceUnlockUI();
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_deleted: true })
        .eq('id', id);
      if (error) throw error;
      toast({ title: "Note moved to trash" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      forceUnlockUI();
    }
  };

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notes</h1>
          <p className="text-muted-foreground">Keep your thoughts and project details organized</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => handleOpenCreate("personal")} className="flex items-center gap-2">
            <Lock className="w-4 h-4" /> New Personal Note
          </Button>
          <Button onClick={() => handleOpenCreate("workspace")} className="flex items-center gap-2 shadow-lg shadow-primary/20">
            <Plus className="w-5 h-5" /> New Workspace Note
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            className="pl-10 border-none shadow-none focus-visible:ring-0" 
            placeholder="Search notes..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading && !saving ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed">
          <StickyNote className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-muted-foreground">No notes found. Create your first note!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="border-none shadow-sm hover:shadow-md transition-all group relative">
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
                      <DropdownMenuItem className="text-rose-500" onClick={() => handleDelete(note.id)}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="cursor-pointer" onClick={() => handleOpenEdit(note)}>
                <h3 className="font-bold text-lg mb-2 line-clamp-1">{note.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-4 min-h-[5rem] whitespace-pre-wrap">
                  {note.content}
                </p>
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-2 pt-0 border-t mt-4 pt-4">
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
        if (!open) {
          setEditingNote(null);
          forceUnlockUI();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit Note' : 'Create New Note'}</DialogTitle>
            <DialogDescription>
              {form.visibility === 'personal' ? 'This note will only be visible to you.' : 'This note will be shared with the workspace team.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input 
                value={form.title} 
                onChange={e => setForm({...form, title: e.target.value})} 
                placeholder="Note title..."
                required
                disabled={saving}
              />
            </div>
            {form.visibility === 'workspace' && (
              <div className="space-y-2">
                <Label>Link to Team (Optional)</Label>
                <Select value={form.sub_workspace_id} onValueChange={v => setForm({...form, sub_workspace_id: v})}>
                  <SelectTrigger disabled={saving}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Team Link</SelectItem>
                    {subWorkspaces.map(team => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea 
                value={form.content} 
                onChange={e => setForm({...form, content: e.target.value})} 
                placeholder="Write something..."
                rows={8}
                required
                disabled={saving}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); forceUnlockUI(); }} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editingNote ? 'Save Changes' : 'Create Note'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
