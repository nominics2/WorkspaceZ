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
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Tasks", icon: CheckSquare, href: "/tasks" },
  { label: "Chat", icon: MessageSquare, href: "/chat" },
  { label: "Calendar", icon: Calendar, href: "/calendar" },
  { label: "Notes", icon: StickyNote, href: "/notes" },
  { label: "Admin Panel", icon: Layers, href: "/workspace" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeWorkspace, workspaces, switchWorkspace } = useWorkspace();
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  };

  return (
    <div className="flex flex-col h-full bg-white border-r w-64">
      <div className="p-6">
        {!mounted ? (
          <div className="w-full h-12 rounded-lg bg-slate-100 animate-pulse" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                type="button"
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {activeWorkspace?.name?.[0] || 'W'}
                    </span>
                  </div>
                  <div className="text-left overflow-hidden">
                     <h1 className="text-sm font-bold truncate text-foreground">
                       {activeWorkspace?.name || 'WorkspaceZ'}
                     </h1>
                     <p className="text-[10px] text-muted-foreground truncate">
                       {activeWorkspace?.join_code || ''}
                     </p>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              {workspaces.map((ws) => (
                <DropdownMenuItem key={ws.id} onClick={() => switchWorkspace(ws.id)}>
                  {ws.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => router.push('/workspace-setup')} className="text-primary font-medium">
                Create/Join New
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <span className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
                <item.icon className="w-5 h-5" />
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t space-y-2">
        <Link href="/settings">
          <span className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground",
            pathname === "/settings" && "bg-primary/10 text-primary"
          )}>
            <Settings className="w-5 h-5" />
            Settings
          </span>
        </Link>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </Button>
      </div>
    </div>
  );
}
