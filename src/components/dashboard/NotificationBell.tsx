"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Loader2, Check, MessageSquare, Sparkles, PlaneTakeoff, Bug } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useFloatingChat } from "@/components/chat/FloatingChatProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter, usePathname } from "next/navigation";

export function NotificationBell() {
  const { activeWorkspace, userProfile } = useWorkspace();
  const { notificationPrefs, muteStates, playNotificationSound, expandedChannelId } = useFloatingChat();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const fetchNotifications = useCallback(async () => {
    if (!userProfile) return;

    setLoading(true);
    try {
      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userProfile.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(10);

      // Workspace-specific or global notifications
      if (activeWorkspace) {
        query = query.or(`workspace_id.eq.${activeWorkspace.id},workspace_id.is.null`);
      } else {
        query = query.is("workspace_id", null);
      }

      const { data, error } = await query;

      if (error) throw error;
      setNotifications(data || []);

      // Count unread
      const unread = (data || []).filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [userProfile, activeWorkspace, supabase]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!userProfile) return;

    const channel = supabase
      .channel(`realtime:notifications:${userProfile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userProfile.id}`,
        },
        (payload) => {
          const newNotif = payload.new;
          const belongsToWorkspace = !newNotif.workspace_id || newNotif.workspace_id === activeWorkspace?.id;
          
          if (belongsToWorkspace && !newNotif.is_deleted) {
            setNotifications((prev) => {
              if (prev.some(n => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev].slice(0, 10);
            });
            setUnreadCount((prev) => prev + 1);
            
            // Respect Notification Preferences for Chat/Message types
            const isChatRelated = newNotif.type === 'chat' || newNotif.type === 'message' || newNotif.type === 'chat_message' || !!newNotif.related_message_id;
            const channelId = newNotif.related_channel_id || newNotif.channel_id;
            
            if (isChatRelated) {
              const inAppEnabled = notificationPrefs?.in_app_enabled ?? true;
              const showPreview = notificationPrefs?.show_message_preview ?? true;
              const soundEnabled = notificationPrefs?.sound_enabled ?? true;

              // Check if channel is muted
              const muteInfo = channelId ? muteStates[channelId] : null;
              const isMuted = muteInfo?.is_muted && (!muteInfo.muted_until || new Date(muteInfo.muted_until) > new Date());

              if (isMuted) return;

              // Check if user is currently looking at this chat
              const isReading = (pathname === '/chat' && expandedChannelId === null) || (expandedChannelId === channelId);

              if (inAppEnabled && !isReading) {
                toast({
                  title: newNotif.title || "New Message",
                  description: showPreview ? newNotif.message : "New message received",
                });
              }

              // Play Sound if enabled and not currently reading
              if (soundEnabled && !isReading) {
                playNotificationSound();
              }

              // Handle browser notifications if enabled and tab is hidden
              if (notificationPrefs?.browser_enabled && document.visibilityState === 'hidden' && "Notification" in window && Notification.permission === "granted") {
                new Notification(newNotif.title || "WorkspaceZ", {
                  body: showPreview ? newNotif.message : "New message received",
                  icon: "/brand/logomark.png"
                });
              }
            } else {
              // Generic fallback for non-chat notifications
              toast({
                title: newNotif.title || "New Notification",
                description: newNotif.message,
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userProfile.id}`,
        },
        (payload) => {
          const updatedNotif = payload.new;
          if (updatedNotif.is_deleted) {
            setNotifications(prev => prev.filter(n => n.id !== updatedNotif.id));
          } else {
            setNotifications(prev => prev.map(n => n.id === updatedNotif.id ? updatedNotif : n));
          }
          fetchNotifications(); // Full refetch to ensure count is accurate
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile, activeWorkspace, supabase, toast, fetchNotifications, notificationPrefs, muteStates, playNotificationSound, pathname, expandedChannelId]);

  const handleMarkAsRead = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const { error } = await supabase.rpc("mark_notification_read", {
        p_notification_id: id
      });

      if (error) throw error;
      
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!userProfile) return;
    try {
      const { error } = await supabase.rpc("mark_all_notifications_read", {
        p_workspace_id: activeWorkspace?.id
      });

      if (error) throw error;
      
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      fetchNotifications();
    } catch (err: any) {
      console.error("Error marking all as read:", err);
    }
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      try {
        await supabase.rpc("mark_notification_read", {
          p_notification_id: notification.id
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Error marking as read on click:", err);
      }
    }

    if (notification.type === 'app_update' && notification.related_app_update_id) {
      router.push(`/app-updates?id=${notification.related_app_update_id}`);
    } else if (notification.type === 'chat_message' || notification.related_message_id) {
      router.push(`/chat`);
    } else if (notification.related_task_id) {
      router.push(`/tasks?taskId=${notification.related_task_id}`);
    } else if (notification.related_note_id) {
      router.push(`/notes?noteId=${notification.related_note_id}`);
    } else if (notification.type?.startsWith('leave_request') || notification.related_leave_request_id) {
      router.push(`/leave?id=${notification.related_leave_request_id || ''}`);
    } else if (notification.related_reminder_id) {
      router.push(`/dashboard`);
    } else if (notification.type === 'bug_report') {
      router.push(`/app-updates/admin`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl">
          <Bell className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-slate-950 rounded-full animate-in zoom-in"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 md:w-96 p-0 overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
        <DropdownMenuLabel className="p-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex items-center justify-between">
          <div className="flex flex-col text-slate-950 dark:text-slate-100">
            <span className="text-sm font-bold">Notifications</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Stay updated with your work</span>
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => handleMarkAllAsRead(e)}
              className="h-7 text-[10px] font-bold text-primary hover:text-primary hover:bg-primary/5 uppercase tracking-wider"
            >
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <div className="max-h-[70vh] overflow-y-auto bg-slate-50/30 dark:bg-slate-950/10">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell className="h-6 w-6 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No notifications yet.</p>
              <p className="text-xs text-muted-foreground mt-1">We'll notify you when something happens.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map((notification) => (
                <div 
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "relative group p-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/80 flex gap-3 cursor-pointer",
                    !notification.is_read && "bg-primary/[0.02] dark:bg-primary/[0.05]"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        {!notification.is_read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                        <span className="text-xs font-bold truncate text-slate-900 dark:text-slate-100">
                          {notification.title || "New Notification"}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {new Date(notification.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[8px] h-4 py-0 px-1.5 font-bold uppercase tracking-widest bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                        {notification.type === 'chat_message' ? 'Chat' : (notification.type || 'System').replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    !notification.is_read ? "bg-primary/10 text-primary" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  )}>
                    {notification.type === 'app_update' ? <Sparkles className="w-4 h-4" /> : 
                     (notification.type === 'chat_message' || !!notification.related_message_id) ? <MessageSquare className="w-4 h-4" /> : 
                     notification.type?.startsWith('leave_request') ? <PlaneTakeoff className="w-4 h-4" /> :
                     notification.type === 'bug_report' ? <Bug className="w-4 h-4" /> :
                     <Bell className="w-4 h-4" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DropdownMenuSeparator className="m-0 dark:bg-slate-800" />
        <div className="p-2 bg-white dark:bg-slate-900 text-center">
          <Button 
            variant="ghost" 
            className="w-full h-8 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100"
            onClick={() => router.push('/settings')}
          >
            View all history
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
