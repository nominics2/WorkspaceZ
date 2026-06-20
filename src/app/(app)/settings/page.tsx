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
  Layout
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { usePushNotifications } from "@/components/providers/PushNotificationProvider";
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
import { useRouter } from "next/navigation";

type TabType = 'profile' | 'appearance' | 'notifications' | 'install';

const AVATAR_PRESETS = Array.from({ length: 10 }, (_, i) => `character_${i + 1}`);

export default function SettingsPage() {
  const { activeWorkspace, userProfile, refreshWorkspaces, themePreference, setThemePreference } = useWorkspace();
  const { isSupported, isConfigured, isSubscribed, permissionState, isIOS, isStandalone, isLoading: pushLoading, enablePush, disablePush } = usePushNotifications();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [storageUsage, setStorageUsage] = useState({ used: 0, limit: 1024 * 1024 * 1024 }); 
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifLoading, setNotifLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    username: "",
    avatar_preset: "" as string | null
  });

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

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

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

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleNotificationClick = (n: any) => {
    if (n.type === 'app_update' && n.related_app_update_id) {
      router.push(`/app-updates?id=${n.related_app_update_id}`);
      return;
    }
    
    if (n.related_task_id) {
      router.push(`/tasks?taskId=${n.related_task_id}`);
    } else if (n.related_note_id) {
      router.push(`/notes?noteId=${n.related_note_id}`);
    } else if (n.related_message_id) {
      router.push(`/chat`);
    } else if (n.related_reminder_id || n.related_leave_request_id) {
      router.push(`/dashboard`);
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
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-100">Settings</h1>
          <p className="text-muted-foreground">Manage your account, workspace, and preferences.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <aside className="md:col-span-1 space-y-2">
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
              activeTab === 'profile' ? "bg-primary/10 text-primary font-bold shadow-sm" : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
            )}
          >
            <User className="w-5 h-5" /> Account Profile
          </button>
          <button 
            onClick={() => setActiveTab('appearance')}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
              activeTab === 'appearance' ? "bg-primary/10 text-primary font-bold shadow-sm" : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
            )}
          >
            <Palette className="w-5 h-5" /> Appearance
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
              activeTab === 'notifications' ? "bg-primary/10 text-primary font-bold shadow-sm" : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
            )}
          >
            <Bell className="w-5 h-5" /> Notifications
          </button>
          <button 
            onClick={() => setActiveTab('install')}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
              activeTab === 'install' ? "bg-primary/10 text-primary font-bold shadow-sm" : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
            )}
          >
            <Smartphone className="w-5 h-5" /> Install App
          </button>
          
          <Separator className="my-4 dark:border-slate-800" />
          
          <div className="px-3">
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
          
          <div className="pt-8">
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
              <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 dark:border dark:border-slate-800">
                <CardHeader className="bg-white dark:bg-slate-900 border-b dark:border-slate-800">
                  <CardTitle className="text-slate-950 dark:text-slate-100">Public Profile</CardTitle>
                  <CardDescription>Update your personal information visible to your team.</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleUpdateProfile} className="space-y-8">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="relative group">
                        <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden shrink-0">
                          {currentDisplayAvatar ? (
                            <img src={currentDisplayAvatar} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-primary font-bold text-3xl">{userProfile?.full_name?.[0]}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-center sm:text-left flex-1">
                        <h3 className="text-xl font-bold text-slate-950 dark:text-slate-100">{userProfile?.full_name}</h3>
                        <p className="text-muted-foreground text-sm">{userProfile?.email}</p>
                        <div className="pt-2">
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-none px-3 h-6">
                            {activeWorkspace?.name || 'Loading workspace...'} Member
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="text-sm font-bold text-slate-950 dark:text-slate-100">Profile Icon</Label>
                      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-11 gap-3">
                        <button
                          type="button"
                          onClick={() => setProfileForm(f => ({ ...f, avatar_preset: null }))}
                          className={cn(
                            "aspect-square rounded-xl border-2 flex items-center justify-center transition-all hover:scale-105 shadow-sm",
                            profileForm.avatar_preset === null 
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                              : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950"
                          )}
                          title="Use Initials"
                        >
                          <UserCircle className={cn("w-6 h-6", profileForm.avatar_preset === null ? "text-primary" : "text-slate-400 dark:text-slate-500")} />
                        </button>
                        {AVATAR_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setProfileForm(f => ({ ...f, avatar_preset: preset }))}
                            className={cn(
                              "aspect-square rounded-xl border-2 overflow-hidden transition-all hover:scale-105 shadow-sm",
                              profileForm.avatar_preset === preset ? "border-primary ring-2 ring-primary/20" : "border-slate-100 dark:border-slate-800"
                            )}
                          >
                            <img src={`/avatars/${preset}.png`} alt={preset} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Select a character icon or use your initials.</p>
                    </div>

                    <Separator className="dark:border-slate-800" />

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="full_name" className="text-slate-950 dark:text-slate-100">Full Name</Label>
                        <Input 
                          id="full_name" 
                          value={profileForm.full_name ?? ""} 
                          onChange={(e) => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
                          placeholder="Your real name"
                          disabled={savingProfile}
                          className="dark:bg-slate-900 dark:border-slate-800"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username" className="text-slate-950 dark:text-slate-100">Username</Label>
                        <Input 
                          id="username" 
                          value={profileForm.username ?? ""} 
                          onChange={(e) => setProfileForm(f => ({ ...f, username: e.target.value }))}
                          placeholder="unique_handle"
                          disabled={savingProfile}
                          className="dark:bg-slate-900 dark:border-slate-800"
                        />
                        <p className="text-[10px] text-muted-foreground">3-20 characters, lowercase, numbers, or underscores.</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-950 dark:text-slate-100">Email Address</Label>
                      <Input value={userProfile?.email ?? ""} disabled className="bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed dark:border-slate-700" />
                      <p className="text-[10px] text-muted-foreground italic">Email change is managed by workspace administrators.</p>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button type="submit" disabled={savingProfile} className="gap-2">
                        {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 dark:border dark:border-slate-800">
                <CardHeader className="bg-white dark:bg-slate-900 border-b dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-primary" />
                    <CardTitle className="text-slate-950 dark:text-slate-100">Workspace Usage</CardTitle>
                  </div>
                  <CardDescription>Resources consumed by your active workspace.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-2xl font-bold text-slate-950 dark:text-slate-100">{usedMB} MB</p>
                          <p className="text-xs text-muted-foreground">of {totalGB} GB limit used</p>
                        </div>
                        <span className="text-sm font-bold text-primary">{usagePercentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={usagePercentage} className="h-3" />
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-start gap-3">
                        <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
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
              <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 dark:border dark:border-slate-800">
                <CardHeader className="bg-white dark:bg-slate-900 border-b dark:border-slate-800">
                  <CardTitle className="text-slate-950 dark:text-slate-100">Theme Preference</CardTitle>
                  <CardDescription>Choose how WorkspaceZ looks on your device.</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      onClick={() => setThemePreference('light')}
                      className={cn(
                        "relative flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all group hover:bg-slate-50 dark:hover:bg-slate-800",
                        themePreference === 'light' 
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-4 ring-blue-500/10" 
                          : "border-slate-100 dark:border-slate-800"
                      )}
                    >
                      <div className={cn(
                        "p-4 rounded-xl bg-white shadow-sm border",
                        themePreference === 'light' ? "text-blue-500 border-blue-500/20" : "text-slate-400 border-slate-200"
                      )}>
                        <Sun className="w-8 h-8" />
                      </div>
                      <div className="text-center">
                        <p className={cn("font-bold text-sm", themePreference === 'light' ? "text-blue-600" : "text-slate-900 dark:text-slate-100")}>Light</p>
                        <p className="text-[10px] text-muted-foreground">Always bright and clear</p>
                      </div>
                      {themePreference === 'light' && (
                        <div className="absolute top-3 right-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-500" />
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => setThemePreference('dark')}
                      className={cn(
                        "relative flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all group hover:bg-slate-50 dark:hover:bg-slate-800",
                        themePreference === 'dark' 
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-4 ring-blue-500/10" 
                          : "border-slate-100 dark:border-slate-800"
                      )}
                    >
                      <div className={cn(
                        "p-4 rounded-xl bg-slate-900 shadow-sm border",
                        themePreference === 'dark' ? "text-blue-400 border-blue-500/20" : "text-slate-400 border-slate-700"
                      )}>
                        <Moon className="w-8 h-8" />
                      </div>
                      <div className="text-center">
                        <p className={cn("font-bold text-sm", themePreference === 'dark' ? "text-blue-400" : "text-slate-900 dark:text-slate-100")}>Dark</p>
                        <p className="text-[10px] text-muted-foreground">Easy on the eyes</p>
                      </div>
                      {themePreference === 'dark' && (
                        <div className="absolute top-3 right-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-500" />
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => setThemePreference('system')}
                      className={cn(
                        "relative flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all group hover:bg-slate-50 dark:hover:bg-slate-800",
                        themePreference === 'system' 
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-4 ring-blue-500/10" 
                          : "border-slate-100 dark:border-slate-800"
                      )}
                    >
                      <div className={cn(
                        "p-4 rounded-xl bg-slate-100 dark:bg-slate-800 shadow-sm border",
                        themePreference === 'system' ? "text-blue-500 border-blue-500/20" : "text-slate-400 border-slate-200 dark:border-slate-700"
                      )}>
                        <Monitor className="w-8 h-8" />
                      </div>
                      <div className="text-center">
                        <p className={cn("font-bold text-sm", themePreference === 'system' ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-slate-100")}>System</p>
                        <p className="text-[10px] text-muted-foreground">Follow your device</p>
                      </div>
                      {themePreference === 'system' && (
                        <div className="absolute top-3 right-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-500" />
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
              <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Smartphone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Push Notifications</CardTitle>
                      <CardDescription>Stay updated even when Workspace Z is closed.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
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
                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border dark:border-slate-800">
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
                        <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1.5 px-1">
                          <Info className="w-3 h-3" /> Notifications are blocked in your browser settings.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-950 dark:text-slate-100">Notification History</h2>
                  <Badge variant="secondary" className="rounded-full">{notifications.length}</Badge>
                </div>
                {notifications.some(n => !n.is_read) && (
                  <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="h-8 text-xs gap-2 dark:border-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark All as Read
                  </Button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                 <div className="flex items-center gap-2 flex-1">
                    <Filter className="w-4 h-4 ml-2 text-slate-400 dark:text-slate-500" />
                    <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                      <SelectTrigger className="border-none shadow-none focus:ring-0 h-8 text-xs w-full sm:w-[140px] dark:bg-slate-900">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="unread">Unread</SelectItem>
                        <SelectItem value="read">Read</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
                 {availableTypes.length > 0 && (
                   <Select value={typeFilter} onValueChange={setTypeFilter}>
                     <SelectTrigger className="border-none shadow-none focus:ring-0 h-8 text-xs w-full sm:w-[140px] dark:bg-slate-900">
                       <SelectValue placeholder="Type" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="all">All Types</SelectItem>
                       {availableTypes.map(t => (
                         <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 )}
              </div>

              {notifLoading && notifications.length === 0 ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
              ) : filteredNotifications.length === 0 ? (
                <Card className="border-none shadow-sm bg-slate-50 dark:bg-slate-800/20">
                  <CardContent className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm">
                      <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-slate-950 dark:text-slate-100">No notification history yet</p>
                      <p className="text-sm text-muted-foreground">Adjust your filters or wait for new activity.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredNotifications.map((n) => (
                    <Card 
                      key={n.id} 
                      className={cn(
                        "border-none shadow-sm hover:shadow-md transition-all group overflow-hidden cursor-pointer",
                        !n.is_read ? "bg-primary/[0.02] ring-1 ring-primary/10" : "bg-white dark:bg-slate-900 dark:border dark:border-slate-800"
                      )}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <CardContent className="p-4 flex items-start gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                          !n.is_read ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        )}>
                          {n.type === 'app_update' ? <Sparkles className="w-5 h-5" /> : n.is_read ? <Check className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className={cn("text-sm font-bold truncate", !n.is_read ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400")}>
                              {n.title}
                            </h4>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {new Date(n.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">{n.message}</p>
                          <div className="flex items-center gap-3 pt-1">
                            {n.type && (
                              <Badge variant="secondary" className="text-[9px] h-4 py-0 px-1.5 uppercase font-bold tracking-wider dark:bg-slate-800 dark:text-slate-400">
                                {n.type.replace('_', ' ')}
                              </Badge>
                            )}
                            {n.read_at && (
                              <span className="text-[9px] text-muted-foreground">
                                Read {new Date(n.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!n.is_read && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-primary hover:bg-primary/5"
                              onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                              title="Mark as read"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            onClick={(e) => { e.stopPropagation(); handleMoveToTrash(n.id); }}
                            title="Move to trash"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
              <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 dark:border dark:border-slate-800">
                <CardHeader className="bg-white dark:bg-slate-900 border-b dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Smartphone className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">App Installation</CardTitle>
                        <CardDescription>Install Workspace Z on your device for the best experience.</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(
                      "text-[10px] uppercase font-bold px-2 py-0.5",
                      isStandalone ? "border-emerald-500 text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "border-slate-200 dark:border-slate-800 text-slate-500"
                    )}>
                      {isStandalone ? "Installed" : "Browser Mode"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  {isStandalone ? (
                    <div className="p-12 text-center space-y-4">
                      <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-500/20">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Workspace Z is ready!</h3>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        You are currently using the installed application. You'll get better notifications and faster performance.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                           <Layout className="w-4 h-4" /> Quick Install
                        </h3>
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border dark:border-slate-800 flex flex-col items-center gap-4 text-center">
                          <div className="p-4 bg-primary/10 rounded-full mb-2">
                            <Download className="w-8 h-8 text-primary animate-bounce" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-bold text-lg text-slate-950 dark:text-slate-100">Add to your device</p>
                            <p className="text-sm text-muted-foreground max-w-xs">
                              {deferredPrompt 
                                ? "One click to install Workspace Z on your desktop or mobile device." 
                                : "Install instructions are available below for your specific platform."}
                            </p>
                          </div>
                          {deferredPrompt && (
                            <Button onClick={handleInstallApp} className="w-full sm:w-auto px-12 h-12 rounded-xl shadow-lg shadow-primary/20 gap-2 text-lg">
                              Install Workspace Z
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">iOS / Safari</h3>
                          <div className="p-4 bg-white dark:bg-slate-950 rounded-2xl border dark:border-slate-800 space-y-4 shadow-sm">
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
                              <p className="text-xs leading-relaxed">Open Workspace Z in the <strong>Safari</strong> browser.</p>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
                              <p className="text-xs leading-relaxed flex items-center flex-wrap gap-1.5">
                                Tap the <Share className="w-3.5 h-3.5 text-blue-500" /> Share button in the bottom menu.
                              </p>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0">3</div>
                              <p className="text-xs leading-relaxed flex items-center flex-wrap gap-1.5">
                                Scroll down and tap <PlusSquare className="w-3.5 h-3.5 text-slate-500" /> <strong>Add to Home Screen</strong>.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Android / Windows / macOS</h3>
                          <div className="p-4 bg-white dark:bg-slate-950 rounded-2xl border dark:border-slate-800 space-y-4 shadow-sm">
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
                              <p className="text-xs leading-relaxed">Use the <strong>Install</strong> button at the top of this page if available.</p>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
                              <p className="text-xs leading-relaxed">On Desktop, look for the <Download className="w-3.5 h-3.5 text-blue-500" /> icon in your address bar.</p>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0">3</div>
                              <p className="text-xs leading-relaxed">On Android, tap <strong>Add Workspace Z to Home Screen</strong> if prompted.</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30 flex gap-3">
                        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-amber-900 dark:text-amber-400">Why install?</p>
                          <p className="text-xs text-amber-800 dark:text-amber-500 leading-relaxed">
                            Installed apps get their own icon, run in full-screen without address bars, and support native push notifications for real-time task alerts.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
