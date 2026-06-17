"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Loader2, Check } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { activeWorkspace, userProfile } = useWorkspace();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();

  const fetchNotifications = useCallback(async () => {
    if (!userProfile) return;

    setLoading(true);
    try {
      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userProfile.id)
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

  const handleMarkAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!userProfile) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", userProfile.id)
        .eq("is_read", false);

      if (error) throw error;
      
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 hover:bg-slate-100 rounded-xl">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-[10px] font-bold border-2 border-white rounded-full animate-in zoom-in"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 md:w-96 p-0 overflow-hidden shadow-2xl border-none rounded-2xl">
        <DropdownMenuLabel className="p-4 bg-white border-b flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-bold">Notifications</span>
            <span className="text-[10px] text-muted-foreground font-normal">Stay updated with your work</span>
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleMarkAllAsRead}
              className="h-7 text-[10px] font-bold text-primary hover:text-primary hover:bg-primary/5 uppercase tracking-wider"
            >
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <div className="max-h-[70vh] overflow-y-auto bg-slate-50/30">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">No notifications yet.</p>
              <p className="text-xs text-muted-foreground mt-1">We'll notify you when something happens.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={cn(
                    "relative group p-4 transition-colors hover:bg-slate-50/80 flex gap-3",
                    !notification.is_read && "bg-primary/[0.02]"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        {!notification.is_read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                        <span className="text-xs font-bold truncate">
                          {notification.title || "New Notification"}
                        </span>
                      </div>
                      <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                        {new Date(notification.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {notification.type && (
                        <Badge variant="outline" className="text-[8px] h-4 py-0 px-1 font-bold uppercase tracking-widest bg-white">
                          {notification.type}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {!notification.is_read && (
                    <button 
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-primary p-1 hover:bg-primary/10 rounded-lg shrink-0 h-fit"
                      title="Mark as read"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="p-2 bg-white text-center">
          <Button variant="ghost" className="w-full h-8 text-xs font-medium text-muted-foreground hover:text-foreground">
            View all notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
