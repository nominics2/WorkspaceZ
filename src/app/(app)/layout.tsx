import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { WorkspaceProvider } from "@/components/providers/WorkspaceProvider";
import { GlobalSearch } from "@/components/dashboard/GlobalSearch";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { Menu } from "lucide-react";
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
              </div>
              <GlobalSearch />
            </div>
            
            <div className="flex items-center gap-2 md:gap-4 ml-4 shrink-0">
               <NotificationBell />
               <div className="hidden sm:flex flex-col items-end gap-0.5">
                  <img src="/brand/wordmark.png" alt="WorkspaceZ" className="h-3.5 w-auto object-contain dark:hidden" />
                  <img src="/brand/wordmark-dark.png" alt="WorkspaceZ" className="h-3.5 w-auto object-contain hidden dark:block" />
                  <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Productivity Suite</p>
               </div>
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
