"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  CheckSquare, 
  Calendar, 
  MessageSquare, 
  StickyNote, 
  Settings, 
  LogOut,
  Layers
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Tasks", icon: CheckSquare, href: "/tasks" },
  { label: "Chat", icon: MessageSquare, href: "/chat" },
  { label: "Calendar", icon: Calendar, href: "/calendar" },
  { label: "Notes", icon: StickyNote, href: "/notes" },
  { label: "Workspace", icon: Layers, href: "/workspace" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-white border-r w-64">
      <div className="p-6 flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xl">W</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">WorkspaceZ</h1>
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
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10">
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </Button>
      </div>
    </div>
  );
}