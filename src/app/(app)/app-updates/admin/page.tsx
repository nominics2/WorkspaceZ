"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
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
  BellRing,
  Smartphone,
  MessageSquare,
  MoreVertical,
  ClipboardList,
  UserX,
  UserMinus,
  Mail,
  Fingerprint,
  Layers,
  AlertTriangle,
  ShieldAlert
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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { getWorkspaceIconSrc } from "@/lib/workspace-icons";

export default function AppUpdatesAdminPage() {
  const { userProfile } = useWorkspace();
  const [isDeveloper, setIsDeveloper] = useState<boolean | null>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pushingId, setPushingId] = useState<string | null>(null);
  
  const [userSearchQuery, setUserSearchQuery] = useState("");

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
    is_active: true,
    release_date: new Date().toISOString().split('T')[0]
  });

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState<any>(null);
  const [reviewForm, setReviewForm] = useState({
    status: "new",
    developer_note: ""
  });

  // User Deletion State
  const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  const forceUnlockUI = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = "";
      document.body.style.overflow = "";
    }
  }, []);

  const checkDev = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("[Dev Check] No user session found.");
        setIsDeveloper(false);
        return;
      }

      console.log(`[Dev Check] Verifying access for ${user.email} (${user.id})...`);

      const { data, error } = await supabase.rpc('is_app_developer', {
        p_user_id: user.id
      });

      if (error) {
        console.error("[Dev Check] RPC Error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      }
      
      console.log(`[Dev Check] Result for ${user.email}:`, data);
      setIsDeveloper(!!data);
    } catch (err) {
      console.error("[Dev Check] Failed:", err);
      setIsDeveloper(false);
    }
  }, [supabase]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [updatesRes, featuresRes, requestsRes, wsRes, usersRes, membershipsRes] = await Promise.all([
        supabase.from('app_updates').select('*').order('published_at', { ascending: false }),
        supabase.from('app_features').select('*').order('category', { ascending: true }).order('sort_order', { ascending: true }),
        supabase.from('app_feature_requests').select('*, profiles(full_name, email), workspaces(name)').order('created_at', { ascending: false }),
        supabase.from('workspaces').select('id, name, icon_preset').order('name', { ascending: true }),
        supabase.from('profiles').select('id, full_name, username, avatar_url, avatar_preset, email, created_at, updated_at').order('created_at', { ascending: false }),
        supabase.from('workspace_members').select('user_id')
      ]);

      // Calculate workspace counts per user
      const membershipCounts: Record<string, number> = {};
      membershipsRes.data?.forEach(m => {
        membershipCounts[m.user_id] = (membershipCounts[m.user_id] || 0) + 1;
      });

      const enrichedUsers = (usersRes.data || []).map(u => ({
        ...u,
        workspace_count: membershipCounts[u.id] || 0
      }));

      setUpdates(updatesRes.data || []);
      setFeatures(featuresRes.data || []);
      setRequests(requestsRes.data || []);
      setWorkspaces(wsRes.data || []);
      setUsers(enrichedUsers);
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
    if (isDeveloper === true) {
      fetchData();
    }
  }, [isDeveloper, fetchData]);

  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return users;
    const q = userSearchQuery.toLowerCase();
    return users.filter(u => 
      u.full_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  }, [users, userSearchQuery]);

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

      if (updateId && updateForm.audience_type !== 'all_users') {
        await supabase.from('app_update_targets').delete().eq('update_id', updateId);
        
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
      forceUnlockUI();
    }
  };

  const handlePushToNotifications = async (id: string) => {
    setPushingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Authentication session expired.");

      const response = await fetch('/api/push/app-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ updateId: id })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Failed to deliver notifications.");

      const { sentCount, inAppNotificationCount, failedCount, disabledCount } = result;

      toast({ 
        title: "Broadcast Complete", 
        description: `In-app: ${inAppNotificationCount}, Web Push: ${sentCount}. (${failedCount} failed, ${disabledCount} revoked)` 
      });
      fetchData();
    } catch (err: any) {
      console.error("[Push] Delivery Failed:", err);
      toast({ 
        variant: "destructive", 
        title: "Delivery Failed", 
        description: err.message || "An error occurred while pushing notifications." 
      });
    } finally {
      setPushingId(null);
    }
  };

  const handleSaveFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!featureForm.feature_key || !featureForm.title || !featureForm.details || !featureForm.category || !featureForm.release_date) {
      toast({ variant: "destructive", title: "Validation Error", description: "All required fields must be filled." });
      return;
    }

    setSubmitting(true);
    try {
      if (editingFeature) {
        const { error } = await supabase.from('app_features').update(featureForm).eq('id', editingFeature.id);
        if (error) throw error;
        toast({ title: "Feature updated" });
      } else {
        const { error } = await supabase.from('app_features').insert({
          ...featureForm,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });
        if (error) throw error;
        toast({ title: "Feature added" });
      }
      setIsFeatureModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error("[Admin] Feature save error:", err);
      toast({ 
        variant: "destructive", 
        title: "Save Failed", 
        description: `Error: ${err.message}. ${err.details || ''}` 
      });
    } finally {
      setSubmitting(false);
      forceUnlockUI();
    }
  };

  const handleSaveRequestReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingRequest || submitting) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('app_feature_requests')
        .update({
          status: reviewForm.status,
          developer_note: reviewForm.developer_note,
          updated_at: new Date().toISOString()
        })
        .eq('id', reviewingRequest.id);

      if (error) throw error;

      toast({ title: "Request Updated" });
      setIsReviewModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message });
    } finally {
      setSubmitting(false);
      forceUnlockUI();
    }
  };

  const handleDeleteUpdate = async (id: string) => {
    try {
      const { error } = await supabase.from('app_updates').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Deleted" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleDeleteFeature = async (id: string) => {
    try {
      const { error } = await supabase.from('app_features').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Feature removed" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleRealUserDelete = async () => {
    if (!userToDelete || !deleteConfirmEmail.trim()) return;
    
    if (deleteConfirmEmail.toLowerCase() !== userToDelete.email.toLowerCase()) {
      toast({ variant: "destructive", title: "Confirmation Mismatch", description: "The email you typed does not match the user's email." });
      return;
    }

    setIsDeletingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("You must be logged in to delete a user.");

      const response = await fetch('/api/developer/users/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          targetUserId: userToDelete.id,
          confirmEmail: deleteConfirmEmail.trim()
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete user profile.");
      }

      toast({ title: "User removed permanently", description: `Account for ${userToDelete.full_name} has been purged.` });
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      setIsDeleteUserModalOpen(false);
      setUserToDelete(null);
      setDeleteConfirmEmail("");
      
    } catch (err: any) {
      console.error("[Developer Deletion] Error:", err);
      toast({ 
        variant: "destructive", 
        title: "Purge Failed", 
        description: err.message || "An error occurred during account deletion." 
      });
    } finally {
      setIsDeletingUser(false);
      forceUnlockUI();
    }
  };

  if (isDeveloper === null) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground mt-4 font-medium">Verifying credentials...</p>
      </div>
    );
  }

  if (isDeveloper === false) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <ShieldCheck className="w-12 h-12 text-rose-500 opacity-20" />
        <h1 className="text-xl font-bold">Developer Access Required</h1>
        <p className="text-muted-foreground text-center max-w-xs">You do not have the necessary permissions to manage platform-wide features.</p>
        <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>Return to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" /> Developer Console
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Manage platform-wide communication, features, and user accounts.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => { setEditingFeature(null); setFeatureForm({ feature_key: "", title: "", short_description: "", details: "", category: "General", sort_order: features.length, is_active: true, release_date: new Date().toISOString().split('T')[0] }); setIsFeatureModalOpen(true); }} variant="outline" className="rounded-xl h-10 border-amber-500/20 hover:bg-amber-500/5 text-amber-600">
            <Zap className="w-4 h-4 mr-2" /> New Feature
          </Button>
          <Button onClick={() => { setEditingUpdate(null); setUpdateForm({ title: "", summary: "", details: "", update_type: "update", banner_enabled: false, banner_title: "", banner_message: "", audience_type: "all_users", status: "published", target_ids: [] }); setIsUpdateModalOpen(true); }} className="rounded-xl h-10 shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4 mr-2" /> Publish Announcement
          </Button>
        </div>
      </div>

      <Tabs defaultValue="features" className="space-y-6">
        <TabsList className="bg-white dark:bg-slate-900 p-1 border dark:border-slate-800 rounded-xl w-full flex overflow-x-auto no-scrollbar">
          <TabsTrigger value="features" className="rounded-lg px-6 font-bold flex-1 md:flex-none">Feature Catalog</TabsTrigger>
          <TabsTrigger value="requests" className="rounded-lg px-6 font-bold flex items-center gap-2 flex-1 md:flex-none">
            Feedback {requests.filter(r => r.status === 'new').length > 0 && <Badge className="h-4 px-1 bg-rose-500 text-[10px]">{requests.filter(r => r.status === 'new').length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="updates" className="rounded-lg px-6 font-bold flex-1 md:flex-none">Announcements</TabsTrigger>
          <TabsTrigger value="users" className="rounded-lg px-6 font-bold flex-1 md:flex-none flex items-center gap-2">
            Global Users <Badge variant="secondary" className="h-4 px-1 text-[10px]">{users.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f) => (
                <Card key={f.id} className={cn("border-none shadow-md dark:bg-slate-900 group", !f.is_active && "opacity-60")}>
                   <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                         <Badge variant="secondary" className="text-[9px] uppercase dark:bg-slate-800">{f.category}</Badge>
                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingFeature(f); setFeatureForm({...f, release_date: f.release_date ? f.release_date.split('T')[0] : new Date().toISOString().split('T')[0]}); setIsFeatureModalOpen(true); }}><Edit2 className="w-3.5 h-3.5" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500"><Trash2 className="w-3.5 h-3.5" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Feature?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently delete "{f.title}" from the catalog. This cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => forceUnlockUI()}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteFeature(f.id)} className="bg-rose-600 hover:bg-rose-700">Delete Permanently</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
                         <div className="flex flex-col">
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Key: {f.feature_key}</span>
                           <span className="text-[9px] font-medium text-slate-500">{f.release_date ? format(new Date(f.release_date), "PP") : "No Date"}</span>
                         </div>
                         <Badge variant={f.is_active ? "default" : "outline"} className="text-[8px] h-4">
                            {f.is_active ? "Active" : "Hidden"}
                         </Badge>
                      </div>
                   </CardContent>
                </Card>
              ))}
           </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {requests.length === 0 ? (
              <div className="text-center py-20 text-slate-400 italic bg-slate-50 dark:bg-slate-900/40 rounded-3xl border-2 border-dashed dark:border-slate-800">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No feature suggestions received yet.</p>
              </div>
            ) : (
              requests.map((req) => (
                <Card key={req.id} className="border-none shadow-sm dark:bg-slate-900">
                  <CardContent className="p-5 flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-3 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn("text-[9px] font-bold uppercase", 
                          req.status === 'new' ? "border-rose-500 text-rose-500 bg-rose-50/50" :
                          req.status === 'reviewing' ? "border-amber-500 text-amber-500 bg-amber-50/50" :
                          req.status === 'planned' ? "border-blue-500 text-blue-500 bg-blue-50/50" :
                          req.status === 'released' ? "border-emerald-500 text-emerald-500 bg-emerald-50/50" :
                          "border-slate-500 text-slate-500"
                        )}>{req.status}</Badge>
                        <Badge variant="secondary" className="text-[9px] uppercase dark:bg-slate-800">{req.category || 'General'}</Badge>
                        <h3 className="font-bold text-base dark:text-slate-100 truncate">{req.title}</h3>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{req.details}</p>
                      
                      <div className="flex items-center gap-4 flex-wrap pt-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5"><AvatarFallback className="text-[8px]">{req.profiles?.full_name?.[0]}</AvatarFallback></Avatar>
                          <span className="text-[11px] font-medium text-slate-500">{req.profiles?.full_name} <span className="opacity-60">({req.profiles?.email})</span></span>
                        </div>
                        <span className="text-slate-300 dark:text-slate-800">|</span>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Layout className="w-3.5 h-3.5" />
                          {req.workspaces?.name || 'Global'}
                        </div>
                        <span className="text-slate-300 dark:text-slate-800">|</span>
                        <span className="text-[11px] text-slate-500 font-medium">{format(new Date(req.created_at), "MMM d, yyyy")}</span>
                      </div>

                      {req.developer_note && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border dark:border-slate-800 mt-2">
                          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 flex items-center gap-1.5">
                            <ShieldCheck className="w-3 h-3" /> Dev Response
                          </p>
                          <p className="text-xs italic text-slate-500 dark:text-slate-400">"{req.developer_note}"</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex md:flex-col items-center justify-end gap-2 shrink-0">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="rounded-xl h-9 px-4 gap-2 dark:border-slate-800"
                        onClick={() => {
                          setReviewingRequest(req);
                          setReviewForm({ status: req.status, developer_note: req.developer_note || "" });
                          setIsReviewModalOpen(true);
                        }}
                      >
                        <ClipboardList className="w-4 h-4" /> Review
                      </Button>
                      <DropdownMenu onOpenChange={() => forceUnlockUI()}>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                           <DropdownMenuItem onClick={() => { /* Toggle archived etc */ }} className="text-rose-500"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="updates" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {updates.length === 0 ? (
              <p className="text-center py-20 text-slate-400 italic bg-slate-50 dark:bg-slate-900/40 rounded-3xl border-2 border-dashed dark:border-slate-800">No announcements published yet.</p>
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
                              {pushingId === up.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Smartphone className="w-3.5 h-3.5 mr-1.5" />}
                              Push
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="dark:text-white">Broadcast Announcement?</AlertDialogTitle>
                              <AlertDialogDescription className="dark:text-slate-400">
                                This will generate in-app alerts and real Web Push notifications for all targeted users.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="dark:bg-slate-900 dark:text-white dark:border-slate-800" onClick={() => forceUnlockUI()}>Cancel</AlertDialogCancel>
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

        <TabsContent value="users" className="space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 shadow-sm">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search users by name, handle, or email..." 
                className="pl-10 h-10 dark:bg-slate-950 border-none shadow-none"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
              <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {users.length} Total</div>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />
              <div className="flex items-center gap-1.5 text-primary"><Check className="w-3.5 h-3.5" /> All Verified</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border-2 border-dashed dark:border-slate-800">
                <p className="text-slate-400 italic">No users found matching your search.</p>
              </div>
            ) : (
              filteredUsers.map((user) => (
                <Card key={user.id} className="border-none shadow-sm dark:bg-slate-900 group">
                  <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Avatar className="h-14 w-14 border-2 border-white dark:border-slate-800 shadow-sm">
                        <AvatarImage src={user.avatar_preset ? `/avatars/${user.avatar_preset}.png` : user.avatar_url} />
                        <AvatarFallback className="font-bold bg-primary/10 text-primary uppercase text-lg">{user.full_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-extrabold text-base dark:text-slate-100 truncate">{user.full_name}</h3>
                          <Badge variant="secondary" className="text-[9px] font-bold py-0 h-4 dark:bg-slate-800">@{user.username}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5"><Mail className="w-3 h-3" /> {user.email}</p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                           <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Joined {format(new Date(user.created_at), "MMM yyyy")}</span>
                           <span className="w-1 h-1 bg-slate-300 rounded-full" />
                           <span className="flex items-center gap-1 text-violet-500"><Layers className="w-3 h-3" /> {user.workspace_count} Workspaces</span>
                           <span className="w-1 h-1 bg-slate-300 rounded-full" />
                           <span className="flex items-center gap-1"><Fingerprint className="w-3 h-3" /> {user.id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0 border-t md:border-none pt-3 md:pt-0">
                      <DropdownMenu onOpenChange={() => forceUnlockUI()}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-9 px-4 gap-2 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold">
                            <MoreVertical className="w-4 h-4" />
                            Manage User
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 dark:bg-slate-950">
                          <DropdownMenuItem disabled className="opacity-50 gap-2"><UserX className="w-4 h-4" /> Deactivate Account</DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-rose-500 gap-2 focus:bg-rose-50 dark:focus:bg-rose-500/10" 
                            disabled={user.id === userProfile?.id}
                            onClick={() => {
                              setUserToDelete(user);
                              setDeleteConfirmEmail("");
                              setIsDeleteUserModalOpen(true);
                            }}
                          >
                            <UserMinus className="w-4 h-4" /> Delete Profile
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="dark:bg-slate-800" />
                          <div className="px-2 py-1.5 text-[9px] font-bold text-muted-foreground uppercase leading-tight italic">
                            Account purges are final and irreversible
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete User Modal */}
      <Dialog open={isDeleteUserModalOpen} onOpenChange={(open) => { if (!isDeletingUser) { setIsDeleteUserModalOpen(open); if (!open) forceUnlockUI(); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden dark:bg-slate-950 dark:border-slate-800 rounded-[2rem] shadow-2xl border-none">
          <div className="bg-rose-500 h-2 w-full" />
          <div className="p-8">
            <DialogHeader className="mb-6">
              <div className="w-14 h-14 bg-rose-50 dark:bg-rose-500/10 rounded-2xl flex items-center justify-center mb-4">
                <ShieldAlert className="w-8 h-8 text-rose-500" />
              </div>
              <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white">Delete User Account?</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                This will permanently purge <span className="font-bold text-slate-900 dark:text-slate-100">{userToDelete?.full_name}</span> (@{userToDelete?.username}) from the platform.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mb-8">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/30">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-400 space-y-1">
                    <p className="font-bold uppercase tracking-tight">Warning: Irreversible Action</p>
                    <p className="leading-relaxed">Personal notes, private tasks, and all memberships will be wiped. Shared tasks/notes will remain but will no longer be associated with this user.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Confirm with email address</Label>
                <Input 
                  value={deleteConfirmEmail}
                  onChange={e => setDeleteConfirmEmail(e.target.value)}
                  placeholder={userToDelete?.email}
                  className="rounded-xl h-11 dark:bg-slate-900 border-none font-medium"
                  disabled={isDeletingUser}
                />
              </div>
            </div>

            <DialogFooter className="gap-3 flex-row border-t dark:border-slate-800 pt-6">
              <Button 
                variant="ghost" 
                onClick={() => setIsDeleteUserModalOpen(false)} 
                disabled={isDeletingUser} 
                className="flex-1 rounded-xl h-12"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleRealUserDelete} 
                disabled={isDeletingUser || deleteConfirmEmail.toLowerCase() !== userToDelete?.email.toLowerCase()}
                className="flex-1 rounded-xl h-12 bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/20 font-bold"
              >
                {isDeletingUser ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Purge Account
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog open={isReviewModalOpen} onOpenChange={(open) => { setIsReviewModalOpen(open); if (!open) { setReviewingRequest(null); forceUnlockUI(); } }}>
        <DialogContent className="max-w-md dark:bg-slate-950 dark:border-slate-800 rounded-[2rem] p-0 overflow-hidden">
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold">Review Suggestion</DialogTitle>
              <DialogDescription>Update progress or add internal context for this feature request.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveRequestReview} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Update Status</Label>
                <Select value={reviewForm.status} onValueChange={v => setReviewForm({...reviewForm, status: v})}>
                  <SelectTrigger className="rounded-xl h-11 dark:bg-slate-900 border-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900">
                    <SelectItem value="new">New / Received</SelectItem>
                    <SelectItem value="reviewing">Under Review</SelectItem>
                    <SelectItem value="planned">Planned / In Backlog</SelectItem>
                    <SelectItem value="released">Released / Live</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Developer Note</Label>
                <Textarea 
                  value={reviewForm.developer_note} 
                  onChange={e => setReviewForm({...reviewForm, developer_note: e.target.value})} 
                  placeholder="Record thoughts or explain decision..."
                  rows={4} 
                  className="rounded-xl dark:bg-slate-900 border-none resize-none" 
                />
                <p className="text-[9px] text-muted-foreground italic">Notes are currently only visible to developers.</p>
              </div>

              <DialogFooter className="pt-4 border-t dark:border-slate-800">
                <Button type="button" variant="ghost" onClick={() => setIsReviewModalOpen(false)} disabled={submitting} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={submitting} className="rounded-xl shadow-lg shadow-primary/20 px-8">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Save Status
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Modal */}
      <Dialog open={isUpdateModalOpen} onOpenChange={(open) => { setIsUpdateModalOpen(open); if (!open) forceUnlockUI(); }}>
        <DialogContent className="max-w-2xl dark:bg-slate-950 dark:border-slate-800 rounded-[2rem] p-0 overflow-hidden">
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold">{editingUpdate ? 'Refine Announcement' : 'Publish New Announcement'}</DialogTitle>
              <DialogDescription>Content will be visible to targeted users on their dashboard and notifications.</DialogDescription>
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
                      <SelectItem value="update">System Update</SelectItem>
                      <SelectItem value="feature">New Feature</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="announcement">Announcement</SelectItem>
                      <SelectItem value="memo">Internal Memo</SelectItem>
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
                       <p className="text-sm font-bold">Sticky Banner</p>
                       <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Show high-visibility banner on workspace top</p>
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
                          <SelectItem value="all_users">All Users</SelectItem>
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
                                      <div className="w-5 h-5 rounded overflow-hidden border shrink-0 bg-white">
                                        <img src={getWorkspaceIconSrc(ws.icon_preset)} className="w-full h-full object-cover" alt="" />
                                      </div>
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
                                   {u.id === userProfile?.id && <Badge className="ml-2 h-4 text-[8px] bg-primary/20 text-primary">YOU</Badge>}
                                   {updateForm.target_ids.includes(u.id) && <Check className="w-3.5 h-3.5" />}
                                </button>
                             ))
                          )}
                       </div>
                    </ScrollArea>
                 )}
              </div>

              <DialogFooter className="pt-4 border-t dark:border-slate-800">
                <Button type="button" variant="ghost" onClick={() => { setIsUpdateModalOpen(false); forceUnlockUI(); }} disabled={submitting} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={submitting || !updateForm.title.trim()} className="rounded-xl shadow-lg shadow-primary/20 px-8">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  {editingUpdate ? 'Update Announcement' : 'Publish Announcement'}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feature Modal */}
      <Dialog open={isFeatureModalOpen} onOpenChange={(open) => { setIsFeatureModalOpen(open); if (!open) { setEditingFeature(null); forceUnlockUI(); } }}>
        <DialogContent className="max-w-md dark:bg-slate-950 dark:border-slate-800 rounded-[2rem] p-0 overflow-hidden">
          <div className="p-8">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-2xl font-bold">{editingFeature ? 'Edit Feature' : 'Add to Feature Catalog'}</DialogTitle>
              <DialogDescription>Features are grouped by category and shown in the user roadmap.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveFeature} className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <Label className="text-[10px] uppercase font-bold text-slate-500">Unique Key</Label>
                     <Input value={featureForm.feature_key} onChange={e => setFeatureForm({...featureForm, feature_key: e.target.value})} placeholder="e.g. mobile_app" required className="rounded-xl h-10 dark:bg-slate-900 border-none text-xs" />
                  </div>
                  <div className="space-y-1">
                     <Label className="text-[10px] uppercase font-bold text-slate-500">Release Date</Label>
                     <Input type="date" value={featureForm.release_date} onChange={e => setFeatureForm({...featureForm, release_date: e.target.value})} required className="rounded-xl h-10 dark:bg-slate-900 border-none text-xs" />
                  </div>
               </div>
               
               <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Title</Label>
                  <Input value={featureForm.title} onChange={e => setFeatureForm({...featureForm, title: e.target.value})} placeholder="Feature Title" required className="rounded-xl h-10 dark:bg-slate-900 border-none text-sm" />
               </div>

               <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Summary (Short)</Label>
                  <Input value={featureForm.short_description} onChange={e => setFeatureForm({...featureForm, short_description: e.target.value})} placeholder="Brief overview for the card..." required className="rounded-xl h-10 dark:bg-slate-900 border-none text-sm" />
               </div>

               <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Full Details</Label>
                  <Textarea value={featureForm.details} onChange={e => setFeatureForm({...featureForm, details: e.target.value})} placeholder="In-depth explanation and usage guide..." rows={6} required className="rounded-xl dark:bg-slate-900 border-none text-sm" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <Label className="text-[10px] uppercase font-bold text-slate-500">Category</Label>
                     <Input value={featureForm.category} onChange={e => setFeatureForm({...featureForm, category: e.target.value})} placeholder="e.g. Workflow" required className="rounded-xl h-10 dark:bg-slate-900 border-none text-xs" />
                  </div>
                  <div className="space-y-1">
                     <Label className="text-[10px] uppercase font-bold text-slate-500">Sort Order</Label>
                     <Input type="number" value={featureForm.sort_order} onChange={e => setFeatureForm({...featureForm, sort_order: parseInt(e.target.value) || 0})} className="rounded-xl h-10 dark:bg-slate-900 border-none text-xs" />
                  </div>
               </div>

               <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-800">
                  <div>
                    <Label className="text-sm font-bold">Public Visibility</Label>
                    <p className="text-[9px] text-muted-foreground uppercase">Visible to all workspace members</p>
                  </div>
                  <Switch checked={featureForm.is_active} onCheckedChange={c => setFeatureForm({...featureForm, is_active: c})} />
               </div>

               <DialogFooter className="pt-4 gap-3 flex-row">
                  <Button type="button" variant="ghost" onClick={() => { setIsFeatureModalOpen(false); forceUnlockUI(); }} className="flex-1 rounded-xl">Cancel</Button>
                  <Button type="submit" disabled={submitting} className="flex-1 rounded-xl shadow-lg shadow-primary/20">
                     {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                     {editingFeature ? 'Update Catalog' : 'Add to Catalog'}
                  </Button>
               </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
