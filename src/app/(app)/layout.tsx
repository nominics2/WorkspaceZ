import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { WorkspaceProvider } from "@/components/providers/WorkspaceProvider";
import { GlobalSearch } from "@/components/dashboard/GlobalSearch";
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
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block border-r bg-white shrink-0">
          <SidebarNav />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b bg-white flex items-center justify-between px-4 md:px-8 shrink-0 z-20 sticky top-0 safe-top">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Mobile Sidebar Trigger */}
              <div className="lg:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10">
                      <Menu className="w-6 h-6" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-64">
                    <SheetHeader className="sr-only">
                      <SheetTitle>Navigation Menu</SheetTitle>
                    </SheetHeader>
                    <SidebarNav />
                  </SheetContent>
                </Sheet>
              </div>
              <GlobalSearch />
            </div>
            
            <div className="flex items-center gap-4 ml-4 shrink-0">
               <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold leading-none mb-1">WorkspaceZ</p>
                  <p className="text-[10px] text-muted-foreground">Productivity Suite</p>
               </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">
            <div className="max-w-7xl mx-auto space-y-8 safe-bottom">
              {children}
            </div>
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
