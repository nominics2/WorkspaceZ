"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Sparkles, 
  Plus, 
  Loader2, 
  Trash2, 
  Edit2, 
  Eye, 
  EyeOff, 
  Layout, 
  Users, 
  Send, 
  Calendar,
  RefreshCw,
  Zap,
  Megaphone,
  Wrench,
  FileText,
  ShieldCheck,
  Search,
  Check,
  X,
  ChevronRight,
  Globe,
  BellRing
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AppUpdatesAdminPage() {
  const { userProfile } = useWorkspace();
  const [isDeveloper, setIsDeveloper] = useState<boolean | null>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pushingId, setPushingId] = useState<string | null>(null);
  
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<any>(null);
  const [updateForm, setUpdateForm] = useState({
    title: "",
    summary: "",
    details: "",
    update_type: "update",
    banner_enabled: false,
    banner_title: "",
    banner_message: "",
    audience_type: "all_users",
    status: "published",
    target_ids: [] as string[]
  });

  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<any>(null);
  const [featureForm, setFeatureForm] = useState({
    feature_key: "",
    title: "",
    short_description: "",
    details: "",
    category: "General",
    sort_order: 0,
    is_active: true
  });

  const supabase = createClient();
  const { toast } = useToast();

  const checkDev = useCallback(async () => {
    const { data, error } = await supabase.rpc('is_app_developer');
    if (error) {
      setIsDeveloper(false);
    } else {
      setIsDeveloper(!!data);
    }
  }, [supabase]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [updatesRes, featuresRes, wsRes, usersRes] = await Promise.all([
        supabase.from('app_updates').select('*').order('published_at', { ascending: false }),
        supabase.from('app_features').select('*').order('category', { ascending: true }).order('sort_order', { ascending: true }),
        supabase.from('workspaces').select('id, name').order('name', { ascending: true }),
        supabase.from('profiles').select('id, full_name, username, avatar_url, avatar_preset').order('full_name', { ascending: true }).limit(100)
      ]);

      setUpdates(updatesRes.data || []);
      setFeatures(featuresRes.data || []);
      setWorkspaces(wsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (err) {
      console.error("[Admin] Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    checkDev();
  }, [checkDev]);

  useEffect(() => {
    if (isDeveloper) {
      fetchData();
    }
  }, [isDeveloper, fetchData]);

  const handleSaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        title: updateForm.title,
        summary: updateForm.summary,
        details: updateForm.details,
        update_type: updateForm.update_type,
        banner_enabled: updateForm.banner_enabled,
        banner_title: updateForm.banner_title,
        banner_message: updateForm.banner_message,
        audience_type: updateForm.audience_type,
        status: updateForm.status,
        published_at: editingUpdate?.published_at || new Date().toISOString()
      };

      let updateId = editingUpdate?.id;

      if (editingUpdate) {
        const { error } = await supabase.from('app_updates').update(payload).eq('id', editingUpdate.id);
        if (error) throw error;
        toast({ title: "Update saved" });
      } else {
        const { data, error } = await supabase.from('app_updates').insert(payload).select('id').single();
        if (error) throw error;
        updateId = data.id;
        toast({ title: "Update published" });
      }

      // Handle targeting
      if (updateId && updateForm.audience_type !== 'all_users') {
        // Clear old targets
        await supabase.from('app_update_targets').delete().eq('update_id', updateId);
        
        // Insert new targets
        if (updateForm.target_ids.length > 0) {
          const targetRows = updateForm.target_ids.map(id => ({
            update_id: updateId,
            target_type: updateForm.audience_type === 'selected_workspaces' ? 'workspace' : 'user',
            target_id: id
          }));
          const { error: targetErr } = await supabase.from('app_update_targets').insert(targetRows);
          if (targetErr) throw targetErr;
        }
      }

      setIsUpdateModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePushToNotifications = async (id: string) => {
    setPushingId(id);
    try {
      const { data: count, error } = await supabase.rpc("push_app_update_to_notifications", {
        p_update_id: id
      });

      if (error) throw error;

      toast({ 
        title: "Success", 
        description: `Update pushed to ${count} users successfully.` 
      });
      fetchData();
    } catch (err: any) {
      console.error("[Push] Failed:", err);
      toast({ 
        variant: "destructive", 
        title: "Push Failed", 
        description: err.message || "An error occurred while pushing notifications." 
      });
    } finally {
      setPushingId(null);
    }
  };

  const handleSaveFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingFeature) {
        const { error } = await supabase.from('app_features').update(featureForm).eq('id', editingFeature.id);
        if (error) throw error;
        toast({ title: "Feature updated" });
      } else {
        const { error } = await supabase.from('app_features').insert(featureForm);
        if (error) throw error;
        toast({ title: "Feature added" });
      }
      setIsFeatureModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUpdate = async (id: string) => {
    if (!confirm("Delete this update?")) return;
    try {
      const { error } = await supabase.from('app_updates').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Deleted" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  if (isDeveloper === false) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <X className="w-12 h-12 text-rose-500" />
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">Only platform developers can access this page.</p>
      </div>
    );
  }

  if (loading && !isDeveloper) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" /> Developer Console
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Manage platform-wide communication and features.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => { setEditingFeature(null); setFeatureForm({ feature_key: "", title: "", short_description: "", details: "", category: "General", sort_order: features.length, is_active: true }); setIsFeatureModalOpen(true); }} variant="outline" className="rounded-xl h-10 border-amber-500/20 hover:bg-amber-500/5 text-amber-600">
            <Zap className="w-4 h-4 mr-2" /> New Feature
          </Button>
          <Button onClick={() => { setEditingUpdate(null); setUpdateForm({ title: "", summary: "", details: "", update_type: "update", banner_enabled: false, banner_title: "", banner_message: "", audience_type: "all_users", status: "published", target_ids: [] }); setIsUpdateModalOpen(true); }} className="rounded-xl h-10 shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4 mr-2" /> Publish Update
          </Button>
        </div>
      </div>

      <Tabs defaultValue="updates" className="space-y-6">
        <TabsList className="bg-white dark:bg-slate-900 p-1 border dark:border-slate-800 rounded-xl">
          <TabsTrigger value="updates" className="rounded-lg px-6 font-bold">Platform Updates</TabsTrigger>
          <TabsTrigger value="features" className="rounded-lg px-6 font-bold">Feature Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="updates" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {updates.length === 0 ? (
              <p className="text-center py-20 text-slate-400 italic bg-slate-50 dark:bg-slate-900/40 rounded-3xl border-2 border-dashed dark:border-slate-800">No updates published yet.</p>
            ) : (
              updates.map((up) => (
                <Card key={up.id} className="border-none shadow-sm dark:bg-slate-900 overflow-hidden">
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={cn("p-2.5 rounded-xl shrink-0", 
                        up.update_type === 'feature' ? "bg-amber-50 dark:bg-amber-500/10 text-amber-500" :
                        up.update_type === 'maintenance' ? "bg-slate-100 dark:bg-slate-800 text-slate-500" :
                        up.update_type === 'announcement' ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500" :
                        "bg-blue-50 dark:bg-blue-500/10 text-blue-500"
                      )}>
                        {up.update_type === 'feature' ? <Zap className="w-5 h-5" /> : 
                         up.update_type === 'maintenance' ? <Wrench className="w-5 h-5" /> :
                         up.update_type === 'announcement' ? <Megaphone className="w-5 h-5" /> :
                         <RefreshCw className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg dark:text-slate-100 truncate">{up.title}</h3>
                          <Badge variant="outline" className="text-[9px] uppercase h-4 px-1.5 dark:border-slate-800">{up.status}</Badge>
                          {up.banner_enabled && <Badge className="bg-primary text-white text-[9px] h-4">BANNER</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{up.summary}</p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(up.published_at).toLocaleDateString()}</span>
                           <span className="w-1 h-1 bg-slate-300 rounded-full" />
                           <span className="flex items-center gap-1 text-primary"><Users className="w-3 h-3" /> {up.audience_type.replace('_', ' ')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 border-t md:border-none pt-3 md:pt-0">
                      {up.status === 'published' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 rounded-lg border-primary/20 hover:bg-primary/5 text-primary" disabled={pushingId === up.id}>
                              {pushingId === up.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <BellRing className="w-3.5 h-3.5 mr-1.5" />}
                              Push
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="dark:text-white">Push update to users?</AlertDialogTitle>
                              <AlertDialogDescription className="dark:text-slate-400">
                                This will generate workspace notifications for all targeted users. This action is immediate and cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="dark:bg-slate-900 dark:text-white dark:border-slate-800">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handlePushToNotifications(up.id)} className="bg-primary hover:bg-primary/90 text-white">
                                Confirm & Push
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 rounded-lg" onClick={() => { setEditingUpdate(up); setUpdateForm({...up, target_ids: []}); setIsUpdateModalOpen(true); }}>
                        <Edit2 className="w-4 h-4 mr-2" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" onClick={() => handleDeleteUpdate(up.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f) => (
                <Card key={f.id} className={cn("border-none shadow-md dark:bg-slate-900 group", !f.is_active && "opacity-60")}>
                   <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                         <Badge variant="secondary" className="text-[9px] uppercase dark:bg-slate-800">{f.category}</Badge>
                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingFeature(f); setFeatureForm(f); setIsFeatureModalOpen(true); }}><Edit2 className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500"><Trash2 className="w-3.5 h-3.5" /></Button>
                         </div>
                      </div>
                      <CardTitle className="text-base mt-2 flex items-center gap-2">
                         <Zap className="w-4 h-4 text-amber-500" />
                         {f.title}
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="p-4 pt-0 space-y-3">
                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">{f.short_description}</p>
                      <div className="pt-3 border-t dark:border-slate-800 flex items-center justify-between">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Key: {f.feature_key}</span>
                         <Badge variant={f.is_active ? "default" : "outline"} className="text-[8px] h-4">
                            {f.is_active ? "Active" : "Hidden"}
                         </Badge>
                      </div>
                   </CardContent>
                </Card>
              ))}
           </div>
        </TabsContent>
      </Tabs>

      {/* Update Modal */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent className="max-w-2xl dark:bg-slate-950 dark:border-slate-800 rounded-[2rem] p-0 overflow-hidden">
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold">{editingUpdate ? 'Refine Announcement' : 'Publish New Update'}</DialogTitle>
              <DialogDescription>Content will be visible on the "Updates" page for targeted users.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveUpdate} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Title</Label>
                  <Input value={updateForm.title} onChange={e => setUpdateForm({...updateForm, title: e.target.value})} required className="rounded-xl h-11 dark:bg-slate-900 border-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Type</Label>
                  <Select value={updateForm.update_type} onValueChange={v => setUpdateForm({...updateForm, update_type: v})}>
                    <SelectTrigger className="rounded-xl h-11 dark:bg-slate-900 border-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-slate-900">
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="feature">Feature</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="announcement">Announcement</SelectItem>
                      <SelectItem value="memo">Memo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Summary (Short)</Label>
                <Input value={updateForm.summary} onChange={e => setUpdateForm({...updateForm, summary: e.target.value})} required className="rounded-xl h-11 dark:bg-slate-900 border-none" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Details (Markdown/Text)</Label>
                <Textarea value={updateForm.details} onChange={e => setUpdateForm({...updateForm, details: e.target.value})} rows={6} className="rounded-xl dark:bg-slate-900 border-none" />
              </div>

              <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-800 space-y-4">
                 <div className="flex items-center justify-between">
                    <div>
                       <p className="text-sm font-bold">System Banner</p>
                       <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Show sticky banner on top of workspace</p>
                    </div>
                    <Switch checked={updateForm.banner_enabled} onCheckedChange={c => setUpdateForm({...updateForm, banner_enabled: c})} />
                 </div>
                 {updateForm.banner_enabled && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-300">
                       <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-slate-500">Banner Title</Label>
                          <Input value={updateForm.banner_title} onChange={e => setUpdateForm({...updateForm, banner_title: e.target.value})} className="h-9 dark:bg-slate-950 text-xs" />
                       </div>
                       <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-slate-500">Banner Message</Label>
                          <Input value={updateForm.banner_message} onChange={e => setUpdateForm({...updateForm, banner_message: e.target.value})} className="h-9 dark:bg-slate-950 text-xs" />
                       </div>
                    </div>
                 )}
              </div>

              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Audience Targeting</Label>
                    <Select value={updateForm.audience_type} onValueChange={v => setUpdateForm({...updateForm, audience_type: v, target_ids: []})}>
                       <SelectTrigger className="w-48 h-9 rounded-xl dark:bg-slate-900 border-none text-xs">
                          <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="dark:bg-slate-900">
                          <SelectItem value="all_users">All Platform Users</SelectItem>
                          <SelectItem value="selected_workspaces">Specific Workspaces</SelectItem>
                          <SelectItem value="selected_users">Specific Users</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>

                 {updateForm.audience_type !== 'all_users' && (
                    <ScrollArea className="h-40 border rounded-2xl p-3 dark:border-slate-800 bg-white dark:bg-slate-950">
                       <div className="space-y-2">
                          {updateForm.audience_type === 'selected_workspaces' ? (
                             workspaces.map(ws => (
                                <button key={ws.id} type="button" onClick={() => setUpdateForm(f => ({...f, target_ids: f.target_ids.includes(ws.id) ? f.target_ids.filter(x => x !== ws.id) : [...f.target_ids, ws.id]}))} className={cn("w-full flex items-center justify-between p-2 rounded-xl text-xs", updateForm.target_ids.includes(ws.id) ? "bg-primary/10 text-primary font-bold" : "hover:bg-slate-50 dark:hover:bg-slate-900")}>
                                   <div className="flex items-center gap-2">
                                      <Layout className="w-3.5 h-3.5" />
                                      {ws.name}
                                   </div>
                                   {updateForm.target_ids.includes(ws.id) && <Check className="w-3.5 h-3.5" />}
                                </button>
                             ))
                          ) : (
                             users.map(u => (
                                <button key={u.id} type="button" onClick={() => setUpdateForm(f => ({...f, target_ids: f.target_ids.includes(u.id) ? f.target_ids.filter(x => x !== u.id) : [...f.target_ids, u.id]}))} className={cn("w-full flex items-center justify-between p-2 rounded-xl text-xs", updateForm.target_ids.includes(u.id) ? "bg-primary/10 text-primary font-bold" : "hover:bg-slate-50 dark:hover:bg-slate-900")}>
                                   <div className="flex items-center gap-2">
                                      <Avatar className="w-5 h-5"><AvatarImage src={u.avatar_preset ? `/avatars/${u.avatar_preset}.png` : u.avatar_url} /><AvatarFallback>{u.full_name?.[0]}</AvatarFallback></Avatar>
                                      {u.full_name}
                                   </div>
                                   {updateForm.target_ids.includes(u.id) && <Check className="w-3.5 h-3.5" />}
                                </button>
                             ))
                          )}
                       </div>
                    </ScrollArea>
                 )}
              </div>

              <DialogFooter className="pt-4 border-t dark:border-slate-800">
                <Button type="button" variant="ghost" onClick={() => setIsUpdateModalOpen(false)} disabled={submitting} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={submitting || !updateForm.title.trim()} className="rounded-xl shadow-lg shadow-primary/20 px-8">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  {editingUpdate ? 'Update Announcement' : 'Publish to Platform'}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feature Modal */}
      <Dialog open={isFeatureModalOpen} onOpenChange={setIsFeatureModalOpen}>
        <DialogContent className="max-w-md dark:bg-slate-950 dark:border-slate-800 rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>{editingFeature ? 'Edit Feature' : 'Add Feature Catalog'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveFeature} className="space-y-4 py-4">
             <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-slate-500">Unique Key</Label>
                <Input value={featureForm.feature_key} onChange={e => setFeatureForm({...featureForm, feature_key: e.target.value})} placeholder="e.g. mobile_app" required className="rounded-xl dark:bg-slate-900 border-none" />
             </div>
             <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-slate-500">Title</Label>
                <Input value={featureForm.title} onChange={e => setFeatureForm({...featureForm, title: e.target.value})} placeholder="Mobile Optimized" required className="rounded-xl dark:bg-slate-900 border-none" />
             </div>
             <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-slate-500">Short Description</Label>
                <Input value={featureForm.short_description} onChange={e => setFeatureForm({...featureForm, short_description: e.target.value})} placeholder="A quick summary for the card" required className="rounded-xl dark:bg-slate-900 border-none" />
             </div>
             <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-slate-500">Full Details</Label>
                <Textarea value={featureForm.details} onChange={e => setFeatureForm({...featureForm, details: e.target.value})} placeholder="Detailed instructions or benefits..." rows={4} className="rounded-xl dark:bg-slate-900 border-none" />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <Label className="text-xs uppercase font-bold text-slate-500">Category</Label>
                   <Input value={featureForm.category} onChange={e => setFeatureForm({...featureForm, category: e.target.value})} placeholder="Mobile" className="rounded-xl dark:bg-slate-900 border-none" />
                </div>
                <div className="space-y-1">
                   <Label className="text-xs uppercase font-bold text-slate-500">Sort Order</Label>
                   <Input type="number" value={featureForm.sort_order} onChange={e => setFeatureForm({...featureForm, sort_order: parseInt(e.target.value)})} className="rounded-xl dark:bg-slate-900 border-none" />
                </div>
             </div>
             <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <Label className="text-xs uppercase font-bold text-slate-500">Public Visibility</Label>
                <Switch checked={featureForm.is_active} onCheckedChange={c => setFeatureForm({...featureForm, is_active: c})} />
             </div>
             <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsFeatureModalOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={submitting} className="rounded-xl shadow-lg">
                   {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Check className="w-3 h-3 mr-2" />}
                   {editingFeature ? 'Update Catalog' : 'Add to Catalog'}
                </Button>
             </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
