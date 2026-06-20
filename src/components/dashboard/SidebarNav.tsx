"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  CheckSquare, 
  Calendar, 
  MessageSquare, 
  StickyNote, 
  Settings, 
  LogOut,
  Layers,
  ChevronDown,
  Trash2,
  BadgeCheck,
  ChevronRight,
  User,
  PanelLeft,
  ChevronLeft,
  Plus,
  Sparkles,
  ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useFloatingChat } from "@/components/chat/FloatingChatProvider";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { getWorkspaceIconSrc } from "@/lib/workspace-icons";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Tasks", icon: CheckSquare, href: "/tasks" },
  { label: "Chat", icon: MessageSquare, href: "/chat" },
  { label: "Calendar", icon: Calendar, href: "/calendar" },
  { label: "Notes", icon: StickyNote, href: "/notes" },
  { label: "Updates", icon: Sparkles, href: "/app-updates" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeWorkspace, workspaces, switchWorkspace, hasPermission, userRole, userProfile, isVerified } = useWorkspace();
  const { totalUnreadCount } = useFloatingChat();
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && userProfile) {
      const checkDev = async () => {
        const { data } = await supabase.rpc('is_app_developer', {
          p_user_id: userProfile.id
        });
        setIsDeveloper(!!data);
      };
      checkDev();
    }
  }, [mounted, userProfile, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  };

  const canViewAdminPanel = hasPermission('view_admin_panel');
  const canViewTrash = hasPermission('manage_trash') || userRole === 'superadmin' || userRole === 'admin';

  const avatarSrc = userProfile?.avatar_preset ? `/avatars/${userProfile.avatar_preset}.png` : userProfile?.avatar_url;

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn(
        "flex flex-col h-full bg-white dark:bg-slate-950 transition-all duration-300 border-r dark:border-slate-800 shadow-sm relative group",
        isCollapsed ? "w-20" : "w-64"
      )}>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-10 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-primary z-50 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        <div className={cn("px-6 pt-8 pb-6 flex items-center", isCollapsed ? "justify-center" : "justify-start")}>
          <div className="shrink-0">
             <img src="/brand/logomark.png" alt="WorkspaceZ" className="w-9 h-9 object-contain dark:hidden" />
             <img src="/brand/logomark-dark.png" alt="WorkspaceZ" className="w-9 h-9 object-contain hidden dark:block" />
          </div>
          {!isCollapsed && (
            <span className="ml-3 font-extrabold text-lg tracking-tight text-slate-900 dark:text-white uppercase">
              Workspace<span className="text-primary">Z</span>
            </span>
          )}
        </div>

        <div className={cn("px-4 pb-4", isCollapsed ? "flex justify-center" : "")}>
          {!mounted ? (
            <div className="w-full h-12 rounded-xl bg-slate-100 dark:bg-slate-900 animate-pulse" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  type="button"
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all border border-slate-100 dark:border-slate-800 shadow-sm active:scale-95 group/ws",
                    isCollapsed ? "justify-center w-12" : "w-full justify-between"
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 shadow-lg shadow-primary/20 border border-slate-200 dark:border-slate-800 bg-white">
                      <img 
                        src={getWorkspaceIconSrc(activeWorkspace?.icon_preset)} 
                        alt={activeWorkspace?.name || 'Workspace'} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {!isCollapsed && (
                      <div className="text-left overflow-hidden">
                         <h1 className="text-xs font-bold truncate text-slate-900 dark:text-slate-100">
                           {activeWorkspace?.name || 'Loading...'}
                         </h1>
                         <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest opacity-60">
                           {activeWorkspace?.join_code || ''}
                         </p>
                      </div>
                    )}
                  </div>
                  {!isCollapsed && <ChevronDown className="w-3 h-3 text-slate-400 group-hover/ws:text-primary transition-colors" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 dark:bg-slate-900 dark:border-slate-800 rounded-xl" align={isCollapsed ? "center" : "start"} side="right">
                <div className="p-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b dark:border-slate-800 mb-1">Your Workspaces</div>
                {workspaces.map((ws) => (
                  <DropdownMenuItem key={ws.id} onClick={() => switchWorkspace(ws.id)} className="rounded-lg gap-2 py-2">
                    <div className="w-6 h-6 rounded overflow-hidden border dark:border-slate-800 shrink-0 bg-white">
                      <img 
                        src={getWorkspaceIconSrc(ws.icon_preset)} 
                        alt={ws.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="font-medium truncate flex-1">{ws.name}</span>
                    {ws.id === activeWorkspace?.id && <BadgeCheck className="w-3.5 h-3.5 text-primary ml-auto" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={() => router.push('/workspace-setup')} className="text-primary font-bold gap-2 py-2 mt-1 border-t dark:border-slate-800">
                  <Plus className="w-4 h-4" /> Create New
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1.5 pt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const content = (
              <span className={cn(
                "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm transition-all relative overflow-hidden",
                isActive 
                  ? "bg-primary text-white font-bold shadow-lg shadow-primary/20" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-950 dark:hover:text-slate-100"
              )}>
                <item.icon className={cn("w-5 h-5", isActive ? "scale-110" : "")} />
                {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                
                {item.label === "Chat" && totalUnreadCount > 0 && (
                  <>
                    {!isCollapsed ? (
                      <Badge className={cn(
                        "ml-auto border-none text-[10px] font-bold h-5 px-1.5 rounded-full transition-colors",
                        isActive 
                          ? "bg-white text-primary ring-1 ring-white/30" 
                          : "bg-primary text-white shadow-sm"
                      )}>
                        {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                      </Badge>
                    ) : (
                      <Badge 
                        variant="destructive" 
                        className="absolute top-2 right-2 h-4 min-w-[16px] px-1 flex items-center justify-center text-[8px] font-extrabold border border-white dark:border-slate-950 rounded-full animate-in zoom-in"
                      >
                        {totalUnreadCount > 9 ? "!" : totalUnreadCount}
                      </Badge>
                    )}
                  </>
                )}

                {isActive && !isCollapsed && item.label !== "Chat" && (
                  <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </span>
            );

            return isCollapsed ? (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link href={item.href}>{content}</Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-bold">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              <Link key={item.href} href={item.href}>{content}</Link>
            );
          })}
          
          <div className="my-6 mx-2 border-t dark:border-slate-800 opacity-50" />

          {canViewTrash && (
            <Link href="/trash">
              <span className={cn(
                "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all",
                pathname === "/trash" 
                  ? "bg-rose-500 text-white font-bold shadow-lg shadow-rose-500/20" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400"
              )}>
                <Trash2 className="w-5 h-5" />
                {!isCollapsed && <span>Trash Bin</span>}
              </span>
            </Link>
          )}

          {canViewAdminPanel && (
            <Link href="/workspace">
              <span className={cn(
                "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all",
                pathname === "/workspace" 
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-lg" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                )}>
                <Layers className="w-5 h-5" />
                {!isCollapsed && <span>Admin Panel</span>}
              </span>
            </Link>
          )}

          {isDeveloper && (
            <Link href="/app-updates/admin">
               <span className={cn(
                "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm transition-all relative overflow-hidden",
                pathname === "/app-updates/admin"
                  ? "bg-amber-500 text-white font-bold shadow-lg shadow-amber-500/20" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-amber-500/10 dark:hover:bg-amber-500/20 hover:text-amber-600 dark:hover:text-amber-400"
              )}>
                <ShieldCheck className="w-5 h-5" />
                {!isCollapsed && <span className="flex-1 truncate">Developer</span>}
              </span>
            </Link>
          )}
        </nav>

        <div className="p-4 border-t dark:border-slate-800 space-y-3 mb-safe bg-slate-50/30 dark:bg-slate-900/10">
          {userProfile && (
            <Link href="/settings">
              <div className={cn(
                "flex items-center gap-3 p-2 rounded-xl hover:bg-white dark:hover:bg-slate-900 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800 group/profile",
                isCollapsed ? "justify-center" : "px-3"
              )}>
                <div className="relative">
                  <Avatar className="w-9 h-9 border-2 border-white dark:border-slate-800 shadow-md transition-transform group-hover/profile:scale-105">
                    <AvatarImage src={avatarSrc} />
                    <AvatarFallback className="bg-primary/10 text-primary font-extrabold text-xs">
                      {userProfile.full_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  {isVerified && <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-950 rounded-full p-0.5"><BadgeCheck className="w-3.5 h-3.5 text-primary fill-primary/10" /></div>}
                </div>
                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-extrabold truncate text-slate-900 dark:text-white uppercase tracking-tight">{userProfile.full_name}</p>
                    <p className="text-[10px] text-slate-500 font-medium truncate italic">@{userProfile.username}</p>
                  </div>
                )}
              </div>
            </Link>
          )}

          <div className="flex flex-col gap-1">
            <Link href="/settings">
              <span className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-primary hover:bg-white dark:hover:bg-slate-900 transition-all",
                pathname === "/settings" && "text-primary bg-white dark:bg-slate-900"
              )}>
                <Settings className="w-4 h-4" />
                {!isCollapsed && <span>Preferences</span>}
              </span>
            </Link>
            <button 
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all text-left w-full"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              {!isCollapsed && <span>Sign Out</span>}
            </button>
          </div>
          
          {!isCollapsed && (
            <div className="mt-4 pt-4 border-t dark:border-slate-800 flex flex-col items-center">
               <p className="text-[9px] text-slate-400 font-extrabold tracking-[0.2em] uppercase leading-relaxed text-center">
                 Powered by Eos Studios
               </p>
               <span className="text-[7px] text-slate-400 opacity-50 uppercase font-medium mt-0.5">Creation of Maldives</span>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
