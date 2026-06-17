"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  HardDrive, 
  Shield, 
  Bell, 
  User, 
  Cloud, 
  Loader2, 
  CheckCircle2, 
  Trash2, 
  Filter, 
  Inbox,
  Clock,
  Check
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
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

type TabType = 'profile' | 'notifications';

export default function SettingsPage() {
  const { activeWorkspace, userProfile } = useWorkspace();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [storageUsage, setStorageUsage] = useState({ used: 0, limit: 1024 * 1024 * 1024 }); // Default 1GB
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifLoading, setNotifLoading] = useState(false);
  
  // Notification Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const supabase = createClient();
  const { toast } = useToast();

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

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and workspace preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <aside className="md:col-span-1 space-y-2">
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
              activeTab === 'profile' ? "bg-primary/10 text-primary font-bold shadow-sm" : "hover:bg-slate-100 text-muted-foreground"
            )}
          >
            <User className="w-5 h-5" /> Account Profile
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
              activeTab === 'notifications' ? "bg-primary/10 text-primary font-bold shadow-sm" : "hover:bg-slate-100 text-muted-foreground"
            )}
          >
            <Bell className="w-5 h-5" /> Notification History
          </button>
          <div className="pt-4 mt-4 border-t px-3">
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Resources</p>
             <div className="space-y-4">
               <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span>Storage</span>
                    <span>{Math.round(usagePercentage)}%</span>
                  </div>
                  <Progress value={usagePercentage} className="h-1.5" />
               </div>
             </div>
          </div>
        </aside>

        <div className="md:col-span-3 space-y-6">
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b">
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>Update your personal details and view your role.</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center border-4 border-white shadow-xl overflow-hidden shrink-0">
                      {userProfile?.avatar_url ? (
                        <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-primary font-bold text-3xl">{userProfile?.full_name?.[0]}</span>
                      )}
                    </div>
                    <div className="space-y-2 text-center sm:text-left flex-1">
                      <h3 className="text-2xl font-bold">{userProfile?.full_name}</h3>
                      <p className="text-muted-foreground font-mono text-sm">{userProfile?.username}</p>
                      <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-2">
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-none px-3">
                          {activeWorkspace?.name} Member
                        </Badge>
                        <Badge variant="outline" className="capitalize">{userProfile?.email}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center gap-3">
                  <div className="p-2.5 bg-blue-50 rounded-xl">
                    <HardDrive className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Workspace Storage</CardTitle>
                    <CardDescription>File storage usage for {activeWorkspace?.name || 'Workspace'}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-2xl font-bold">{usedMB} MB</p>
                          <p className="text-xs text-muted-foreground">of {totalGB} GB limit used</p>
                        </div>
                        <span className="text-sm font-bold text-primary">{usagePercentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={usagePercentage} className="h-3" />
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                        <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Your storage limit is managed by the workspace administrator. Standard accounts are limited to 1GB. Contact support to request an increase.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">Notification History</h2>
                  <Badge variant="secondary" className="rounded-full">{notifications.length}</Badge>
                </div>
                {notifications.some(n => !n.is_read) && (
                  <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="h-8 text-xs gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark All as Read
                  </Button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 bg-white p-2 rounded-xl border shadow-sm">
                 <div className="flex items-center gap-2 flex-1">
                    <Filter className="w-4 h-4 ml-2 text-muted-foreground" />
                    <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                      <SelectTrigger className="border-none shadow-none focus:ring-0 h-8 text-xs w-full sm:w-[140px]">
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
                     <SelectTrigger className="border-none shadow-none focus:ring-0 h-8 text-xs w-full sm:w-[140px]">
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
                <Card className="border-none shadow-sm bg-slate-50">
                  <CardContent className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <Inbox className="w-8 h-8 text-slate-300" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold">No notification history yet</p>
                      <p className="text-sm text-muted-foreground">Adjust your filters or wait for new activity.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredNotifications.map((n) => (
                    <Card key={n.id} className={cn(
                      "border-none shadow-sm hover:shadow-md transition-all group overflow-hidden",
                      !n.is_read ? "bg-primary/[0.02] ring-1 ring-primary/10" : "bg-white"
                    )}>
                      <CardContent className="p-4 flex items-start gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                          !n.is_read ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          {n.is_read ? <Check className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className={cn("text-sm font-bold truncate", !n.is_read ? "text-foreground" : "text-muted-foreground")}>
                              {n.title}
                            </h4>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {new Date(n.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{n.message}</p>
                          <div className="flex items-center gap-3 pt-1">
                            {n.type && (
                              <Badge variant="secondary" className="text-[9px] h-4 py-0 px-1.5 uppercase font-bold tracking-wider">
                                {n.type}
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
                              onClick={() => handleMarkRead(id)}
                              title="Mark as read"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                            onClick={() => handleMoveToTrash(n.id)}
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
        </div>
      </div>
    </div>
  );
}
