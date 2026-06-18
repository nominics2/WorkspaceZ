"use client";

import { useState, useEffect } from "react";
import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { WorkspaceProvider } from "@/components/providers/WorkspaceProvider";
import { GlobalSearch } from "@/components/dashboard/GlobalSearch";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { Menu, Bell } from "lucide-react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader,
  SheetTitle,
  SheetTrigger 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WorkspaceProvider>
      <div className="flex h-screen overflow-hidden bg-background text-foreground transition-colors duration-300">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block border-r bg-white dark:bg-slate-950 dark:border-slate-800 shrink-0 shadow-sm z-30">
          <SidebarNav />
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950">
          <header className="h-16 border-b bg-white dark:bg-slate-950 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 z-20 sticky top-0 safe-top shadow-sm">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Mobile Sidebar Trigger */}
              <div className="lg:hidden">
                {mounted ? (
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
                        <Menu className="w-6 h-6" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-64 border-r dark:border-slate-800">
                      <SheetHeader className="sr-only">
                        <SheetTitle>Navigation Menu</SheetTitle>
                      </SheetHeader>
                      <SidebarNav />
                    </SheetContent>
                  </Sheet>
                ) : (
                  <Button variant="ghost" size="icon" disabled className="h-10 w-10 text-slate-500 dark:text-slate-400 opacity-50">
                    <Menu className="w-6 h-6" />
                  </Button>
                )}
              </div>
              <GlobalSearch />
            </div>
            
            <div className="flex items-center gap-2 md:gap-4 ml-4 shrink-0">
               {mounted ? (
                 <NotificationBell />
               ) : (
                 <Button variant="ghost" size="icon" disabled className="h-10 w-10 text-slate-500 dark:text-slate-400 opacity-50">
                   <Bell className="h-5 w-5" />
                 </Button>
               )}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8 scroll-smooth">
            <div className="max-w-7xl mx-auto space-y-8 safe-bottom">
              {children}
            </div>
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
