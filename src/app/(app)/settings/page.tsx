"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { 
  HardDrive, 
  Shield, 
  Bell, 
  User, 
  Loader2, 
  CheckCircle2, 
  Trash2, 
  Filter, 
  Inbox,
  Clock,
  Check,
  LogOut,
  Send,
  Save,
  UserCircle,
  Sun,
  Moon,
  Monitor,
  Palette,
  Sparkles,
  Smartphone,
  AlertTriangle,
  Info,
  Download,
  Share,
  PlusSquare,
  Layout,
  MessageSquare,
  PlaneTakeoff,
  Bug,
  Globe
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { usePushNotifications } from "@/components/providers/PushNotificationProvider";
import { usePwaInstall } from "@/components/providers/PwaInstallProvider";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";

type TabType = 'profile' | 'appearance' | 'notifications' | 'install' | 'bug-report';

const AVATAR_PRESETS = Array.from({ length: 10 }, (_, i) => `character_${i + 1}`);

export default function SettingsPage() {
  const { activeWorkspace, userProfile, refreshWorkspaces, themePreference, setThemePreference } = useWorkspace();
  const { isSupported, isConfigured, isSubscribed, permissionState, isLoading: pushLoading, enablePush, disablePush } = usePushNotifications();
  const { installAvailable, isStandalone, isIOS, promptInstall } = usePwaInstall();
  
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [storageUsage, setStorageUsage] = useState({ used: 0, limit: 1024 * 1024 * 1024 }); 
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifLoading, setNotifLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    username: "",
    avatar_preset: "" as string | null
  });

  const [bugForm, setBugForm] = useState({
    title: "",
    description: ""
  });
  const [submittingBug, setSubmittingBug] = useState(false);

  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const supabase = createClient();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (userProfile) {
      setProfileForm({
        full_name: userProfile.full_name ?? "",
        username: userProfile.username ?? "",
        avatar_preset: userProfile.avatar_preset ?? null
      });
    }
  }, [userProfile]);

  const fetchStorageUsage = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const { data, error } = await supabase
        .from('attachments')
        .select('file_size_bytes')
        .eq('workspace_id', activeWorkspace.id);

      if (error) throw error;

      const totalUsed = data?.reduce((acc, curr) => acc + (curr.file_size_bytes || 0), 0) || 0;
      setStorageUsage(prev => ({ ...prev, used: totalUsed }));
    } catch (err) {
      console.error("Error fetching storage usage:", err);
    }
  }, [activeWorkspace, supabase]);

  const fetchNotifications = useCallback(async () => {
    if (!userProfile) return;
    setNotifLoading(true);
    try {
      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userProfile.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (activeWorkspace) {
        query = query.or(`workspace_id.eq.${activeWorkspace.id},workspace_id.is.null`);
      } else {
        query = query.is("workspace_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      setNotifications(data || []);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error fetching notifications", description: err.message });
    } finally {
      setNotifLoading(false);
    }
  }, [userProfile, activeWorkspace, supabase, toast]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStorageUsage(), fetchNotifications()]).finally(() => setLoading(false));
  }, [fetchStorageUsage, fetchNotifications]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    const usernameRegex = /^[a-z0-9_]{3,20}$/;
    if (!usernameRegex.test(profileForm.username)) {
      toast({
        variant: "destructive",
        title: "Invalid Username",
        description: "Username must be 3-20 characters, lowercase, and only contain letters, numbers, or underscores."
      });
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileForm.full_name,
          username: profileForm.username.toLowerCase(),
          avatar_preset: profileForm.avatar_preset,
          updated_at: new Date().toISOString()
        })
        .eq('id', userProfile.id);

      if (error) throw error;

      toast({ title: "Profile updated successfully!" });
      await refreshWorkspaces();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleBugSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugForm.title.trim() || !bugForm.description.trim()) return;

    setSubmittingBug(true);
    try {
      const { error } = await supabase.rpc("submit_app_bug_report", {
        p_workspace_id: activeWorkspace?.id || null,
        p_title: bugForm.title.trim(),
        p_description: bugForm.description.trim(),
        p_page_url: window.location.href,
        p_device_info: navigator.userAgent,
      });

      if (error) throw error;

      toast({ 
        title: "Bug report submitted.", 
        description: "Thank you, the developer has been notified." 
      });
      setBugForm({ title: "", description: "" });
    } catch (err: any) {
      console.error("[Bug Report] Submission Error:", {
        message: err.message,
        details: err.details,
        hint: err.hint,
        code: err.code
      });
      toast({ variant: "destructive", title: "Unable to submit bug report.", description: "An error occurred while communicating with the server." });
    } finally {
      setSubmittingBug(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleMarkRead = async (id: string) => {
    try {
      const { error } = await supabase.rpc("mark_notification_read", { p_notification_id: id });
      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n));
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const { error } = await supabase.rpc("mark_all_notifications_read", { p_workspace_id: activeWorkspace?.id });
      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: n.read_at || new Date().toISOString() })));
      toast({ title: "All caught up!", description: "All notifications marked as read." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleMoveToTrash = async (id: string) => {
    try {
      const { error } = await supabase.rpc("move_notification_to_trash", { p_notification_id: id });
      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast({ title: "Notification moved to trash" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleNotificationClick = (n: any) => {
    if (n.type === 'app_update' && n.related_app_update_id) {
      router.push(`/app-updates?id=${n.related_app_update_id}`);
    } else if (n.type === 'chat_message' || !!n.related_message_id) {
      router.push(`/chat`);
    } else if (n.related_task_id) {
      router.push(`/tasks?taskId=${n.related_task_id}`);
    } else if (n.related_note_id) {
      router.push(`/notes?noteId=${n.related_note_id}`);
    } else if (n.type?.startsWith('leave_request') || n.related_leave_request_id) {
      router.push(`/leave?id=${n.related_leave_request_id || ''}`);
    } else if (n.related_reminder_id) {
      router.push(`/dashboard`);
    } else if (n.type === 'bug_report') {
      router.push(`/app-updates/admin`);
    }

    if (!n.is_read) {
      handleMarkRead(n.id);
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'read' ? n.is_read : !n.is_read);
      const matchesType = typeFilter === 'all' || n.type === typeFilter;
      return matchesStatus && matchesType;
    });
  }, [notifications, statusFilter, typeFilter]);

  const availableTypes = useMemo(() => {
    const types = new Set(notifications.map(n => n.type).filter(Boolean));
    return Array.from(types);
  }, [notifications]);

  const usagePercentage = (storageUsage.used / storageUsage.limit) * 100;
  const usedMB = (storageUsage.used / (1024 * 1024)).toFixed(2);
  const totalGB = (storageUsage.limit / (1024 * 1024 * 1024)).toFixed(1);

  const currentDisplayAvatar = useMemo(() => {
    if (profileForm.avatar_preset) return `/avatars/${profileForm.avatar_preset}.png`;
    return userProfile?.avatar_url;
  }, [profileForm.avatar_preset, userProfile?.avatar_url]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-100 px-1">Settings</h1>
          <p className="text-sm text-muted-foreground px-1">Manage your account, workspace, and preferences.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <aside className="md:col-span-1">
          <nav className="flex flex-row overflow-x-auto pb-4 md:flex-col md:pb-0 md:space-y-2 no-scrollbar gap-2 md:gap-0 sticky top-0 bg-slate-50 dark:bg-slate-950 z-10 md:static">
            <button 
              onClick={() => setActiveTab('profile')}
              className={cn(
                "flex items-center gap-2 md:gap-3 p-2.5 px-4 md:p-3 rounded-xl md:rounded-lg text-left transition-all whitespace-nowrap text-sm",
                activeTab === 'profile' ? "bg-primary text-white md:bg-primary/10 md:text-primary font-bold shadow-md md:shadow-none" : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
              )}
            >
              <User className="w-4 h-4 md:w-5 md:h-5" /> Profile
            </button>
            <button 
              onClick={() => setActiveTab('appearance')}
              className={cn(
                "flex items-center gap-2 md:gap-3 p-2.5 px-4 md:p-3 rounded-xl md:rounded-lg text-left transition-all whitespace-nowrap text-sm",
                activeTab === 'appearance' ? "bg-primary text-white md:bg-primary/10 md:text-primary font-bold shadow-md md:shadow-none" : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
              )}
            >
              <Palette className="w-4 h-4 md:w-5 md:h-5" /> Theme
            </button>
            <button 
              onClick={() => setActiveTab('notifications')}
              className={cn(
                "flex items-center gap-2 md:gap-3 p-2.5 px-4 md:p-3 rounded-xl md:rounded-lg text-left transition-all whitespace-nowrap text-sm",
                activeTab === 'notifications' ? "bg-primary text-white md:bg-primary/10 md:text-primary font-bold shadow-md md:shadow-none" : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
              )}
            >
              <Bell className="w-4 h-4 md:w-5 md:h-5" /> Alerts
            </button>
            <button 
              onClick={() => setActiveTab('install')}
              className={cn(
                "flex items-center gap-2 md:gap-3 p-2.5 px-4 md:p-3 rounded-xl md:rounded-lg text-left transition-all whitespace-nowrap text-sm",
                activeTab === 'install' ? "bg-primary text-white md:bg-primary/10 md:text-primary font-bold shadow-md md:shadow-none" : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
              )}
            >
              <Smartphone className="w-4 h-4 md:w-5 md:h-5" /> Install
            </button>
            <button 
              onClick={() => setActiveTab('bug-report')}
              className={cn(
                "flex items-center gap-2 md:gap-3 p-2.5 px-4 md:p-3 rounded-xl md:rounded-lg text-left transition-all whitespace-nowrap text-sm",
                activeTab === 'bug-report' ? "bg-rose-500 text-white md:bg-rose-500/10 md:text-rose-600 font-bold shadow-md md:shadow-none" : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
              )}
            >
              <Bug className="w-4 h-4 md:w-5 md:h-5" /> Bug Report
            </button>
          </nav>
          
          <Separator className="my-4 hidden md:block dark:border-slate-800" />
          
          <div className="px-3 hidden md:block">
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Resources</p>
             <div className="space-y-4">
               <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                    <span>Storage</span>
                    <span>{Math.round(usagePercentage)}%</span>
                  </div>
                  <Progress value={usagePercentage} className="h-1.5" />
               </div>
             </div>
          </div>
          
          <div className="pt-8 hidden md:block">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </Button>
          </div>
        </aside>

        <div className="md:col-span-3 space-y-6">
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl md:rounded-lg">
                <CardHeader className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 p-5 md:p-6">
                  <CardTitle className="text-lg md:text-xl text-slate-950 dark:text-slate-100">Public Profile</CardTitle>
                  <CardDescription className="text-xs md:text-sm">Update your personal information visible to your team.</CardDescription>
                </CardHeader>
                <CardContent className="p-5 md:p-6">
                  <form onSubmit={handleUpdateProfile} className="space-y-6 md:space-y-8">
                    <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6">
                      <div className="relative group">
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-primary/10 flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden shrink-0">
                          {currentDisplayAvatar ? (
                            <img src={currentDisplayAvatar} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-primary font-bold text-2xl md:text-3xl">{userProfile?.full_name?.[0] || 'U'}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-center sm:text-left flex-1">
                        <h3 className="text-lg md:text-xl font-bold text-slate-950 dark:text-slate-100">{userProfile?.full_name}</h3>
                        <p className="text-muted-foreground text-xs md:text-sm">{userProfile?.email}</p>
                        <div className="pt-2">
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-none px-3 h-5 md:h-6 text-[10px] md:text-xs">
                            {activeWorkspace?.name || 'Loading workspace...'} Member
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 md:space-y-4">
                      <Label className="text-xs md:text-sm font-bold text-slate-950 dark:text-slate-100 px-1">Profile Icon</Label>
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-11 gap-2 md:gap-3">
                        <button
                          type="button"
                          onClick={() => setProfileForm(f => ({ ...f, avatar_preset: null }))}
                          className={cn(
                            "aspect-square rounded-xl border-2 flex items-center justify-center transition-all hover:scale-105 shadow-sm h-10 md:h-auto",
                            profileForm.avatar_preset === null 
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                              : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950"
                          )}
                          title="Use Initials"
                        >
                          <UserCircle className={cn("w-5 h-5 md:w-6 md:h-6", profileForm.avatar_preset === null ? "text-primary" : "text-slate-400 dark:text-slate-500")} />
                        </button>
                        {AVATAR_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setProfileForm(f => ({ ...f, avatar_preset: preset }))}
                            className={cn(
                              "aspect-square rounded-xl border-2 overflow-hidden transition-all hover:scale-105 shadow-sm h-10 md:h-auto",
                              profileForm.avatar_preset === preset ? "border-primary ring-2 ring-primary/20" : "border-slate-100 dark:border-slate-800"
                            )}
                          >
                            <img src={`/avatars/${preset}.png`} alt={preset} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                      <p className="text-[9px] md:text-[10px] text-muted-foreground px-1">Select a character icon or use your initials.</p>
                    </div>

                    <Separator className="dark:border-slate-800" />

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="full_name" className="text-slate-950 dark:text-slate-100 px-1 text-xs md:text-sm">Full Name</Label>
                        <Input
                          id="full_name" 
                          value={profileForm.full_name ?? ""} 
                          onChange={(e) => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
                          placeholder="Your real name"
                          disabled={savingProfile}
                          className="h-11 md:h-10 dark:bg-slate-900 dark:border-slate-800"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username" className="text-slate-950 dark:text-slate-100 px-1 text-xs md:text-sm">Username</Label>
                        <Input 
                          id="username" 
                          value={profileForm.username ?? ""} 
                          onChange={(e) => setProfileForm(f => ({ ...f, username: e.target.value }))}
                          placeholder="unique_handle"
                          disabled={savingProfile}
                          className="h-11 md:h-10 dark:bg-slate-900 dark:border-slate-800"
                        />
                        <p className="text-[9px] md:text-[10px] text-muted-foreground px-1">3-20 characters, lowercase, numbers, or underscores.</p>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button type="submit" disabled={savingProfile} className="gap-2 w-full md:w-auto h-11 md:h-10 shadow-lg shadow-primary/20">
                        {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl md:rounded-lg">
                <CardHeader className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 p-5 md:p-6">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg md:text-xl text-slate-950 dark:text-slate-100">Workspace Usage</CardTitle>
                  </div>
                  <CardDescription className="text-xs md:text-sm">Resources consumed by your active workspace.</CardDescription>
                </CardHeader>
                <CardContent className="p-5 md:p-6 space-y-6">
                  {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-xl md:text-2xl font-bold text-slate-950 dark:text-slate-100">{usedMB} MB</p>
                          <p className="text-[10px] md:text-xs text-muted-foreground">of {totalGB} GB limit used</p>
                        </div>
                        <span className="text-xs md:text-sm font-bold text-primary">{usagePercentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={usagePercentage} className="h-2 md:h-3" />
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                        <Shield className="w-4 h-4 md:w-5 md:h-5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          Standard workspace accounts are limited to 1GB. To increase this limit, please contact your workspace owner.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl md:rounded-lg">
                <CardHeader className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 p-5 md:p-6">
                  <CardTitle className="text-lg md:text-xl text-slate-950 dark:text-slate-100">Theme Preference</CardTitle>
                  <CardDescription className="text-xs md:text-sm">Choose how WorkspaceZ looks on your device.</CardDescription>
                </CardHeader>
                <CardContent className="p-5 md:p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      onClick={() => setThemePreference('light')}
                      className={cn(
                        "relative flex flex-row sm:flex-col items-center gap-4 p-4 md:p-6 rounded-2xl border-2 transition-all group hover:bg-slate-50 dark:hover:bg-slate-800 text-left sm:text-center",
                        themePreference === 'light' 
                          ? "border-primary bg-primary/5 ring-4 ring-primary/5 shadow-md" 
                          : "border-slate-100 dark:border-slate-800"
                      )}
                    >
                      <div className={cn(
                        "p-3 md:p-4 rounded-xl bg-white shadow-sm border shrink-0",
                        themePreference === 'light' ? "text-primary border-primary/20" : "text-slate-400 border-slate-200"
                      )}>
                        <Sun className="w-6 h-6 md:w-8 md:h-8" />
                      </div>
                      <div className="min-w-0">
                        <p className={cn("font-bold text-sm", themePreference === 'light' ? "text-primary" : "text-slate-900 dark:text-slate-100")}>Light</p>
                        <p className="text-[10px] text-muted-foreground whitespace-nowrap">Always bright</p>
                      </div>
                      {themePreference === 'light' && (
                        <div className="absolute top-2 right-2 md:top-3 md:right-3">
                          <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => setThemePreference('dark')}
                      className={cn(
                        "relative flex flex-row sm:flex-col items-center gap-4 p-4 md:p-6 rounded-2xl border-2 transition-all group hover:bg-slate-50 dark:hover:bg-slate-800 text-left sm:text-center",
                        themePreference === 'dark' 
                          ? "border-primary bg-primary/5 ring-4 ring-primary/5 shadow-md" 
                          : "border-slate-100 dark:border-slate-800"
                      )}
                    >
                      <div className={cn(
                        "p-3 md:p-4 rounded-xl bg-slate-900 shadow-sm border shrink-0",
                        themePreference === 'dark' ? "text-primary border-primary/20" : "text-slate-400 border-slate-700"
                      )}>
                        <Moon className="w-6 h-6 md:w-8 md:h-8" />
                      </div>
                      <div className="min-w-0">
                        <p className={cn("font-bold text-sm", themePreference === 'dark' ? "text-primary" : "text-slate-900 dark:text-slate-100")}>Dark</p>
                        <p className="text-[10px] text-muted-foreground whitespace-nowrap">Easy on eyes</p>
                      </div>
                      {themePreference === 'dark' && (
                        <div className="absolute top-2 right-2 md:top-3 md:right-3">
                          <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => setThemePreference('system')}
                      className={cn(
                        "relative flex flex-row sm:flex-col items-center gap-4 p-4 md:p-6 rounded-2xl border-2 transition-all group hover:bg-slate-50 dark:hover:bg-slate-800 text-left sm:text-center",
                        themePreference === 'system' 
                          ? "border-primary bg-primary/5 ring-4 ring-primary/5 shadow-md" 
                          : "border-slate-100 dark:border-slate-800"
                      )}
                    >
                      <div className={cn(
                        "p-3 md:p-4 rounded-xl bg-slate-100 dark:bg-slate-800 shadow-sm border shrink-0",
                        themePreference === 'system' ? "text-primary border-primary/20" : "text-slate-400 border-slate-200 dark:border-slate-700"
                      )}>
                        <Monitor className="w-6 h-6 md:w-8 md:h-8" />
                      </div>
                      <div className="min-w-0">
                        <p className={cn("font-bold text-sm", themePreference === 'system' ? "text-primary" : "text-slate-900 dark:text-slate-100")}>System</p>
                        <p className="text-[10px] text-muted-foreground whitespace-nowrap">Device setting</p>
                      </div>
                      {themePreference === 'system' && (
                        <div className="absolute top-2 right-2 md:top-3 md:right-3">
                          <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                        </div>
                      )}
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <Card className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-2xl md:rounded-lg">
                <CardHeader className="p-5 md:p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Smartphone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Push Notifications</CardTitle>
                      <CardDescription className="text-xs">Stay updated even when Workspace Z is closed.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 md:p-6 space-y-6">
                  {!isConfigured ? (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex gap-3">
                      <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-400">Not Configured</p>
                        <p className="text-xs text-slate-600 dark:text-slate-500 leading-relaxed">
                          Push notifications are not configured on this server yet. Please contact the administrator.
                        </p>
                      </div>
                    </div>
                  ) : !isSupported ? (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-900/30 flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-amber-900 dark:text-amber-400">Push Not Supported</p>
                        <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">
                          {isIOS && !isStandalone 
                            ? "Install Workspace Z to your Home Screen, then open it from the app icon to enable push notifications." 
                            : "Your browser does not support standard Web Push notifications. Try using a modern browser like Chrome, Edge, or Safari."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border dark:border-slate-800 transition-colors">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-bold">Browser Alerts</Label>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Status: {isSubscribed ? 'Enabled' : permissionState === 'denied' ? 'Permission Blocked' : 'Disabled'}</p>
                        </div>
                        <Switch 
                          checked={isSubscribed} 
                          onCheckedChange={(checked) => checked ? enablePush() : disablePush()}
                          disabled={pushLoading}
                        />
                      </div>
                      
                      {permissionState === 'denied' && (
                        <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1.5 px-1 animate-in slide-in-from-top-1">
                          <Info className="w-3 h-3" /> Notifications are blocked in your browser settings.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg md:text-xl font-bold text-slate-950 dark:text-slate-100">History</h2>
                  <Badge variant="secondary" className="rounded-full bg-slate-100 dark:bg-slate-800 h-5 text-[10px]">{notifications.length}</Badge>
                </div>
                {notifications.some(n => !n.is_read) && (
                  <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="h-8 text-[10px] gap-2 dark:border-slate-800 rounded-lg uppercase font-bold tracking-tighter">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark All as Read
                  </Button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                 <div className="flex items-center gap-2 flex-1">
                    <Filter className="w-4 h-4 ml-2 text-slate-400 dark:text-slate-500" />
                    <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                      <SelectTrigger className="border-none shadow-none focus:ring-0 h-9 text-xs w-full sm:w-[140px] dark:bg-slate-900">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="unread">Unread</SelectItem>
                        <SelectItem value="read">Read</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
                 {availableTypes.length > 0 && (
                   <Select value={typeFilter} onValueChange={setTypeFilter}>
                     <SelectTrigger className="border-none shadow-none focus:ring-0 h-9 text-xs w-full sm:w-[140px] dark:bg-slate-900">
                       <SelectValue placeholder="Type" />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl">
                       <SelectItem value="all">All Types</SelectItem>
                       {availableTypes.map(t => (
                         <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 )}
              </div>

              {notifLoading && notifications.length === 0 ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : filteredNotifications.length === 0 ? (
                <Card className="border-none shadow-sm bg-slate-50 dark:bg-slate-800/20 rounded-2xl">
                  <CardContent className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm">
                      <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-slate-950 dark:text-slate-100">No notifications yet</p>
                      <p className="text-xs text-muted-foreground">Adjust your filters or wait for new activity.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredNotifications.map((n) => (
                    <Card 
                      key={n.id} 
                      className={cn(
                        "border-none shadow-sm hover:shadow-md transition-all group overflow-hidden cursor-pointer rounded-2xl",
                        !n.is_read ? "bg-primary/[0.02] ring-1 ring-primary/10" : "bg-white dark:bg-slate-900 dark:border dark:border-slate-800"
                      )}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <CardContent className="p-4 flex items-start gap-3 md:gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-colors",
                          !n.is_read ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        )}>
                          {n.type === 'app_update' ? <Sparkles className="w-5 h-5" /> : 
                           (n.type === 'chat_message' || !!n.related_message_id) ? <MessageSquare className="w-5 h-5" /> : 
                           n.type?.startsWith('leave_request') ? <PlaneTakeoff className="w-5 h-5" /> :
                           n.type === 'bug_report' ? <Bug className="w-5 h-5" /> :
                           n.is_read ? <Check className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <div className="flex items-center gap-2 overflow-hidden">
                              {!n.is_read && (
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                              )}
                              <span className="text-xs font-bold truncate text-slate-900 dark:text-slate-100">
                                {n.title || "New Notification"}
                              </span>
                            </div>
                            <span className="text-[9px] text-muted-foreground whitespace-nowrap shrink-0">
                              {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{n.message}</p>
                          <div className="flex items-center justify-between gap-2 pt-1.5">
                            <div className="flex items-center gap-2">
                               <Badge variant="secondary" className="text-[8px] h-4 py-0 px-1.5 uppercase font-bold tracking-widest dark:bg-slate-800 dark:text-slate-400 border-none">
                                {n.type === 'chat_message' ? 'Chat' : (n.type || 'System').replace('_', ' ')}
                              </Badge>
                              {n.read_at && (
                                <span className="text-[8px] text-muted-foreground italic">
                                  Read {new Date(n.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              {!n.is_read && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-primary hover:bg-primary/10 rounded-full"
                                  onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full"
                                onClick={(e) => { e.stopPropagation(); handleMoveToTrash(n.id); }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'install' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl md:rounded-lg">
                <CardHeader className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 p-5 md:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                        <Smartphone className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-lg md:text-xl truncate">App Installation</CardTitle>
                        <CardDescription className="text-xs md:text-sm truncate">Optimized experience for your device.</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(
                      "text-[9px] md:text-[10px] uppercase font-bold px-2 py-0.5 whitespace-nowrap",
                      isStandalone ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" : "text-slate-500"
                    )}>
                      {isStandalone ? "Installed" : "Web Mode"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-5 md:p-6 space-y-6 md:space-y-8">
                  {isStandalone ? (
                    <div className="py-10 md:py-12 text-center space-y-4">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border-2 border-emerald-500/20">
                        <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10 text-emerald-500" />
                      </div>
                      <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">Workspace Z is ready!</h3>
                      <p className="text-xs md:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                        You are currently using the installed application. You'll get better notifications and faster performance.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2 px-1">
                           <Layout className="w-3.5 h-3.5" /> Quick Install
                        </h3>
                        <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border dark:border-slate-800 flex flex-col items-center gap-4 text-center shadow-inner">
                          <div className="p-4 bg-primary/10 rounded-full mb-2">
                            <Download className="w-8 h-8 text-primary animate-bounce" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-bold text-lg text-slate-950 dark:text-slate-100">Add to your device</p>
                            <p className="text-xs md:text-sm text-muted-foreground max-w-xs">
                              {installAvailable 
                                ? "One click to install Workspace Z on your desktop or mobile device." 
                                : "Follow instructions below for your specific platform."}
                            </p>
                          </div>
                          {installAvailable && (
                            <Button onClick={promptInstall} className="w-full sm:w-auto px-10 h-12 rounded-xl shadow-xl shadow-primary/20 gap-2 text-base font-bold">
                              Install Now
                            </Button>
                          )}
                          {!installAvailable && !isIOS && (
                            <p className="text-[10px] text-muted-foreground italic bg-white dark:bg-slate-900 px-3 py-1 rounded-full border dark:border-slate-800">Install prompt not supported in this browser.</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 px-1">iOS / Safari</h3>
                          <div className="p-5 bg-white dark:bg-slate-950 rounded-2xl border dark:border-slate-800 space-y-5 shadow-sm">
                            <div className="flex items-start gap-4">
                              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
                              <p className="text-xs leading-relaxed dark:text-slate-300">Open in <strong>Safari</strong> browser.</p>
                            </div>
                            <div className="flex items-start gap-4">
                              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
                              <p className="text-xs leading-relaxed flex items-center flex-wrap gap-1.5 dark:text-slate-300">
                                Tap <Share className="w-3.5 h-3.5 text-blue-500" /> Share in the bottom menu.
                              </p>
                            </div>
                            <div className="flex items-start gap-4">
                              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0">3</div>
                              <p className="text-xs leading-relaxed flex items-center flex-wrap gap-1.5 dark:text-slate-300">
                                Tap <PlusSquare className="w-3.5 h-3.5 text-slate-500" /> <strong>Add to Home Screen</strong>.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 px-1">Other Platforms</h3>
                          <div className="p-5 bg-white dark:bg-slate-950 rounded-2xl border dark:border-slate-800 space-y-5 shadow-sm">
                            <div className="flex items-start gap-4">
                              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
                              <p className="text-xs leading-relaxed dark:text-slate-300">Use the <strong>Install</strong> button above if visible.</p>
                            </div>
                            <div className="flex items-start gap-4">
                              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
                              <p className="text-xs leading-relaxed flex items-center flex-wrap gap-1.5 dark:text-slate-300">
                                On Desktop, look for <Download className="w-3.5 h-3.5 text-blue-500" /> in address bar.
                              </p>
                            </div>
                            <div className="flex items-start gap-4">
                              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0">3</div>
                              <p className="text-xs leading-relaxed dark:text-slate-300">On Android, tap <strong>Add to Home Screen</strong> if prompted.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'bug-report' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl md:rounded-lg">
                <CardHeader className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 p-5 md:p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 dark:bg-rose-500/10 rounded-lg">
                      <Bug className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Report a Problem</CardTitle>
                      <CardDescription className="text-xs">Something not working? Let our developers know.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5 md:p-6">
                  <form onSubmit={handleBugSubmit} className="space-y-5 md:space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="bug_title" className="text-slate-950 dark:text-slate-100 px-1 text-xs md:text-sm">Short Title</Label>
                      <Input 
                        id="bug_title"
                        value={bugForm.title}
                        onChange={(e) => setBugForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="e.g. Chat window doesn't load on mobile"
                        required
                        disabled={submittingBug}
                        className="h-11 md:h-10 rounded-xl dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-none"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="bug_desc" className="text-slate-950 dark:text-slate-100 px-1 text-xs md:text-sm">What happened?</Label>
                      <Textarea 
                        id="bug_desc"
                        value={bugForm.description}
                        onChange={(e) => setBugForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Describe the issue and steps to reproduce..."
                        rows={6}
                        required
                        disabled={submittingBug}
                        className="rounded-2xl dark:bg-slate-900 border-slate-200 dark:border-slate-800 resize-none text-xs md:text-sm shadow-none"
                      />
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border dark:border-slate-800 space-y-3">
                       <div className="flex items-center justify-between text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          <span className="flex items-center gap-1.5"><Globe className="w-3 h-3" /> Page URL</span>
                          <Badge variant="outline" className="h-4 py-0 text-[7px] md:text-[8px] bg-white dark:bg-slate-900 border-none shadow-sm">AUTO-CAPTURED</Badge>
                       </div>
                       <p className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400 font-mono truncate px-1">{typeof window !== 'undefined' ? window.location.href : 'Loading...'}</p>
                       
                       <Separator className="dark:border-slate-800" />
                       
                       <div className="flex items-center justify-between text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          <span className="flex items-center gap-1.5"><Smartphone className="w-3 h-3" /> Device Info</span>
                          <Badge variant="outline" className="h-4 py-0 text-[7px] md:text-[8px] bg-white dark:bg-slate-900 border-none shadow-sm">AUTO-CAPTURED</Badge>
                       </div>
                       <p className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400 font-mono line-clamp-2 leading-relaxed px-1">{typeof navigator !== 'undefined' ? navigator.userAgent : 'Loading...'}</p>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button type="submit" disabled={submittingBug || !bugForm.title.trim() || !bugForm.description.trim()} className="gap-2 h-11 px-8 rounded-xl shadow-lg shadow-rose-500/20 bg-rose-600 hover:bg-rose-700 text-white border-none w-full md:w-auto">
                        {submittingBug ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Submit Report
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
