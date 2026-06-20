"use client";

import { useState, useEffect } from "react";
import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { WorkspaceProvider } from "@/components/providers/WorkspaceProvider";
import { FloatingChatProvider } from "@/components/chat/FloatingChatProvider";
import { PushNotificationProvider } from "@/components/providers/PushNotificationProvider";
import { PwaInstallProvider } from "@/components/providers/PwaInstallProvider";
import { FloatingChatBubbles } from "@/components/chat/FloatingChatBubbles";
import { GlobalSearch } from "@/components/dashboard/GlobalSearch";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { AppUpdateBanner } from "@/components/dashboard/AppUpdateBanner";
import { PwaInstallBanner } from "@/components/dashboard/PwaInstallBanner";
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
    // Register Service Worker for PWA features
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('[PWA] Service Worker registration failed:', err);
      });
    }
  }, []);

  return (
    <WorkspaceProvider>
      <PwaInstallProvider>
        <FloatingChatProvider>
          <PushNotificationProvider>
            <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-foreground transition-colors duration-300">
              {/* Desktop Sidebar */}
              <div className="hidden lg:block h-full shrink-0 z-30">
                <SidebarNav />
              </div>

              <div className="flex-1 flex flex-col min-w-0">
                {/* Global Announcement Banner */}
                <AppUpdateBanner />

                <header className="h-16 border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-md dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 z-20 sticky top-0 safe-top shadow-sm">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Mobile Sidebar Trigger */}
                    <div className="lg:hidden">
                      {mounted ? (
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl">
                              <Menu className="w-6 h-6" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent side="left" className="p-0 w-72 border-r-0 dark:bg-slate-950">
                            <SidebarNav />
                          </SheetContent>
                        </Sheet>
                      ) : (
                        <Button variant="ghost" size="icon" disabled className="h-10 w-10 text-slate-500 opacity-50">
                          <Menu className="w-6 h-6" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex-1 max-w-2xl">
                       <GlobalSearch />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 md:gap-4 ml-4 shrink-0">
                     {mounted ? (
                       <NotificationBell />
                     ) : (
                       <Button variant="ghost" size="icon" disabled className="h-10 w-10 text-slate-500 opacity-50">
                         <Bell className="h-5 w-5" />
                       </Button>
                     )}
                  </div>
                </header>

                <main className="flex-1 overflow-y-auto scroll-smooth">
                  {/* Contextual Installation Banner */}
                  <PwaInstallBanner />
                  
                  <div className="p-4 md:p-8 lg:p-10 max-w-[1600px] mx-auto space-y-8 safe-bottom pb-24 lg:pb-10">
                    {children}
                  </div>
                </main>
              </div>
              
              <FloatingChatBubbles />
            </div>
          </PushNotificationProvider>
        </FloatingChatProvider>
      </PwaInstallProvider>
    </WorkspaceProvider>
  );
}
